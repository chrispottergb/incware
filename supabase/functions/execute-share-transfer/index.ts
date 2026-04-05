import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransferPayload {
  company_id: string;
  company_name?: string;
  entity_type: string;
  transaction_type: string;
  seller_name: string;
  seller_id: string | null;
  buyer_name: string;
  buyer_id: string | null;
  share_class: string;
  num_shares: number;
  price_per_share: number | null;
  total_consideration: number | null;
  consideration_type: string;
  transaction_date: string;
  meeting_id?: string | null;
}

const LLC_TYPES = ["LLC", "Single Member LLC", "LLC-S"];

function isLLCType(entityType: string): boolean {
  return LLC_TYPES.includes(entityType);
}

const TRANSFER_TYPES = [
  "transfer", "share_exchange", "gift",
  "interest_transfer", "interest_assignment",
];
const ISSUANCE_TYPES = [
  "initial_issuance", "initial_contribution", "additional_contribution",
];
const REDEMPTION_TYPES = ["redemption", "dissociation_buyout"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // Verify user via getUser
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Parse and validate payload
    const payload: TransferPayload = await req.json();
    if (!payload.company_id || !payload.transaction_type || !payload.seller_name || !payload.num_shares || payload.num_shares <= 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isLLC = isLLCType(payload.entity_type || "Corporation");
    const isTransfer = TRANSFER_TYPES.includes(payload.transaction_type);
    const isIssuance = ISSUANCE_TYPES.includes(payload.transaction_type);
    const isRedemption = REDEMPTION_TYPES.includes(payload.transaction_type);
    const effectiveBuyerName = isRedemption ? (payload.company_name || "Treasury") : payload.buyer_name;

    // Use service role client for all writes (bypasses RLS for atomicity)
    // But first verify user owns the company
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: company, error: companyErr } = await adminClient
      .from("companies")
      .select("id, user_id, name")
      .eq("id", payload.company_id)
      .single();

    if (companyErr || !company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Access denied: you do not own this company" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use raw SQL via pg for atomic transaction
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    try {
      const result = await sql.begin(async (tx: any) => {
        // Fetch existing shareholders
        const shareholders = await tx`
          SELECT id, name, status, capital_account_balance
          FROM shareholders
          WHERE company_id = ${payload.company_id}
        `;

        // Fetch existing certificates
        const certificates = await tx`
          SELECT id, certificate_number, shareholder_id, share_class, num_shares, status, par_value, cancelled_date
          FROM stock_certificates
          WHERE company_id = ${payload.company_id}
          ORDER BY certificate_number
        `;

        // Helper: get next cert number
        let certOffset = 0;
        const getNextCertNum = () => {
          const maxExisting = certificates.length > 0
            ? Math.max(...certificates.map((c: any) => c.certificate_number))
            : 0;
          certOffset++;
          return maxExisting + certOffset;
        };

        const certActions: string[] = [];

        // ── 1. Insert primary share_transaction ──
        const [txn] = await tx`
          INSERT INTO share_transactions (
            company_id, transaction_type, shareholder_id, share_class,
            num_shares, price_per_share, total_consideration, consideration_type,
            transaction_date, from_shareholder, to_shareholder, meeting_id
          ) VALUES (
            ${payload.company_id}, ${payload.transaction_type},
            ${payload.seller_id || null}, ${payload.share_class},
            ${payload.num_shares}, ${payload.price_per_share || null},
            ${payload.total_consideration || null}, ${payload.consideration_type},
            ${payload.transaction_date}, ${payload.seller_name},
            ${isRedemption ? "Treasury" : payload.buyer_name},
            ${payload.meeting_id || null}
          )
          RETURNING id
        `;

        // ── 2. Insert bill_of_sale ──
        const [bill] = await tx`
          INSERT INTO bills_of_sale (
            company_id, seller_name, buyer_name, share_class,
            num_shares, price_per_share, total_price, sale_date,
            shareholder_id, transaction_id
          ) VALUES (
            ${payload.company_id}, ${payload.seller_name}, ${effectiveBuyerName},
            ${payload.share_class}, ${payload.num_shares},
            ${payload.price_per_share || null}, ${payload.total_consideration || null},
            ${payload.transaction_date}, ${payload.seller_id || null}, ${txn.id}
          )
          RETURNING id
        `;

        // ── 3. Update transaction with bill_of_sale_id ──
        await tx`
          UPDATE share_transactions SET bill_of_sale_id = ${bill.id}
          WHERE id = ${txn.id}
        `;

        // ── 4. Upsert buyer as shareholder if new ──
        let buyerShId = payload.buyer_id || null;
        let buyerSh = !isRedemption
          ? shareholders.find((s: any) => s.name.toLowerCase().trim() === payload.buyer_name.toLowerCase().trim())
          : null;

        if (!isRedemption && !buyerSh && payload.buyer_name.trim()) {
          const [newSh] = await tx`
            INSERT INTO shareholders (company_id, name, status)
            VALUES (${payload.company_id}, ${payload.buyer_name.trim()}, 'active')
            RETURNING id, name
          `;
          buyerSh = newSh;
          buyerShId = newSh.id;
        } else if (buyerSh) {
          buyerShId = buyerSh.id;
        }

        // ── 5. Link transaction to buyer shareholder ──
        if (!isRedemption && buyerShId) {
          await tx`
            UPDATE share_transactions SET shareholder_id = ${buyerShId}
            WHERE id = ${txn.id}
          `;
        }

        // ── 6. Certificate lifecycle ──
        if (isTransfer || isRedemption) {
          const sellerSh = shareholders.find(
            (s: any) => s.name.toLowerCase().trim() === payload.seller_name.toLowerCase().trim()
          );

          if (sellerSh) {
            const sellerCert = certificates.find(
              (c: any) =>
                c.shareholder_id === sellerSh.id &&
                c.share_class === payload.share_class &&
                c.status === "active"
            );

            if (sellerCert) {
              const cancelReason = isRedemption
                ? `Treasury repurchase of ${payload.num_shares} shares`
                : `Transfer of ${payload.num_shares} shares to ${payload.buyer_name}`;

              // Cancel seller's active certificate
              await tx`
                UPDATE stock_certificates
                SET status = 'cancelled', cancelled_date = ${payload.transaction_date},
                    cancelled_reason = ${cancelReason}
                WHERE id = ${sellerCert.id}
              `;
              certActions.push(`Cancelled Cert #${sellerCert.certificate_number} (${payload.seller_name})`);

              // Cancellation ledger entry
              await tx`
                INSERT INTO share_transactions (
                  company_id, transaction_type, shareholder_id, share_class,
                  num_shares, transaction_date, from_shareholder, to_shareholder,
                  transferred_certificate_id, notes
                ) VALUES (
                  ${payload.company_id}, 'cancellation', ${sellerSh.id}, ${payload.share_class},
                  ${sellerCert.num_shares || 0}, ${payload.transaction_date}, ${payload.seller_name}, NULL,
                  ${sellerCert.id},
                  ${`Cancelled Cert #${sellerCert.certificate_number} — ${isRedemption ? 'treasury repurchase' : `partial transfer to ${payload.buyer_name}`}`}
                )
              `;

              // Issue remainder cert to seller if they retain shares
              const remainingShares = (sellerCert.num_shares || 0) - payload.num_shares;
              if (remainingShares > 0) {
                const newCertNum = getNextCertNum();
                const [sellerNewCert] = await tx`
                  INSERT INTO stock_certificates (
                    company_id, certificate_number, shareholder_id, share_class,
                    num_shares, issue_date, par_value
                  ) VALUES (
                    ${payload.company_id}, ${newCertNum}, ${sellerSh.id}, ${payload.share_class},
                    ${remainingShares}, ${payload.transaction_date}, ${sellerCert.par_value}
                  )
                  RETURNING id
                `;

                // Reissuance ledger entry
                await tx`
                  INSERT INTO share_transactions (
                    company_id, transaction_type, shareholder_id, share_class,
                    num_shares, transaction_date, from_shareholder, to_shareholder,
                    certificate_id, notes
                  ) VALUES (
                    ${payload.company_id}, 'reissuance', ${sellerSh.id}, ${payload.share_class},
                    ${remainingShares}, ${payload.transaction_date}, NULL, ${payload.seller_name},
                    ${sellerNewCert.id},
                    ${`Reissued Cert #${newCertNum} to ${payload.seller_name} for remaining ${remainingShares} shares after transfer`}
                  )
                `;

                certActions.push(`Issued Cert #${newCertNum} to ${payload.seller_name} for ${remainingShares} shares`);
              } else {
                // Mark seller inactive
                await tx`
                  UPDATE shareholders SET status = 'inactive' WHERE id = ${sellerSh.id}
                `;
                certActions.push(`${payload.seller_name} marked as former shareholder (0 shares)`);
              }
            }
          }

          // Issue cert to buyer (transfers only, not redemptions)
          if (isTransfer && buyerSh) {
            const buyerExistingCert = certificates.find(
              (c: any) =>
                c.shareholder_id === buyerSh!.id &&
                c.share_class === payload.share_class &&
                c.status === "active"
            );
            let buyerExistingShares = 0;
            if (buyerExistingCert) {
              buyerExistingShares = buyerExistingCert.num_shares || 0;
              await tx`
                UPDATE stock_certificates
                SET status = 'cancelled', cancelled_date = ${payload.transaction_date},
                    cancelled_reason = ${`Consolidated — received ${payload.num_shares} shares from ${payload.seller_name}`}
                WHERE id = ${buyerExistingCert.id}
              `;
              certActions.push(`Cancelled Cert #${buyerExistingCert.certificate_number} (${payload.buyer_name}) for consolidation`);
            }

            const buyerCertNum = getNextCertNum();
            await tx`
              INSERT INTO stock_certificates (
                company_id, certificate_number, shareholder_id, share_class,
                num_shares, issue_date
              ) VALUES (
                ${payload.company_id}, ${buyerCertNum}, ${buyerSh.id}, ${payload.share_class},
                ${payload.num_shares + buyerExistingShares}, ${payload.transaction_date}
              )
            `;
            certActions.push(`Issued Cert #${buyerCertNum} to ${payload.buyer_name} for ${(payload.num_shares + buyerExistingShares)} shares`);
          }

          if (isRedemption) {
            certActions.push(`${payload.num_shares} shares returned to treasury`);
          }
        }

        // Issuance cert logic
        if (isIssuance && buyerSh) {
          const buyerExistingCert = certificates.find(
            (c: any) =>
              c.shareholder_id === buyerSh!.id &&
              c.share_class === payload.share_class &&
              c.status === "active"
          );
          let existingShares = 0;
          if (buyerExistingCert) {
            existingShares = buyerExistingCert.num_shares || 0;
            await tx`
              UPDATE stock_certificates
              SET status = 'cancelled', cancelled_date = ${payload.transaction_date},
                  cancelled_reason = ${`Consolidated — additional issuance of ${payload.num_shares} shares`}
              WHERE id = ${buyerExistingCert.id}
            `;
            certActions.push(`Cancelled Cert #${buyerExistingCert.certificate_number} for consolidation`);
          }

          const issueCertNum = getNextCertNum();
          await tx`
            INSERT INTO stock_certificates (
              company_id, certificate_number, shareholder_id, share_class,
              num_shares, issue_date
            ) VALUES (
              ${payload.company_id}, ${issueCertNum}, ${buyerSh.id}, ${payload.share_class},
              ${payload.num_shares + existingShares}, ${payload.transaction_date}
            )
          `;
          certActions.push(`Issued Cert #${issueCertNum} to ${payload.buyer_name} for ${payload.num_shares + existingShares} shares`);
        }

        // ── 7. Update transaction with denormalized cert numbers ──
        const issuedCertNum = certActions.find(a => a.includes("Issued Cert #"))?.match(/#(\d+)/)?.[1];
        const surrenderedCertNum = certActions.find(a => a.includes("Cancelled Cert #"))?.match(/#(\d+)/)?.[1];
        if (issuedCertNum || surrenderedCertNum) {
          await tx`
            UPDATE share_transactions SET
              issued_certificate_number = ${issuedCertNum ? parseInt(issuedCertNum) : null},
              surrendered_certificate_number = ${surrenderedCertNum ? parseInt(surrenderedCertNum) : null}
            WHERE id = ${txn.id}
          `;
        }

        // ── 8. LLC: recalculate ownership percentages ──
        if (isLLC) {
          await tx`SELECT public.recalculate_ownership_percentages(${payload.company_id}::uuid)`;
        }

        // ── 9. LLC: update capital account balances ──
        if (isLLC) {
          const capitalDelta = payload.total_consideration || 0;
          if (isIssuance && buyerShId && capitalDelta > 0) {
            const [sh] = await tx`
              SELECT capital_account_balance FROM shareholders WHERE id = ${buyerShId}
            `;
            const currentBalance = Number(sh?.capital_account_balance || 0);
            await tx`
              UPDATE shareholders SET capital_account_balance = ${currentBalance + capitalDelta}
              WHERE id = ${buyerShId}
            `;
          }
          if (isRedemption && payload.seller_id && capitalDelta > 0) {
            const [sh] = await tx`
              SELECT capital_account_balance FROM shareholders WHERE id = ${payload.seller_id}
            `;
            const currentBalance = Number(sh?.capital_account_balance || 0);
            await tx`
              UPDATE shareholders SET capital_account_balance = ${currentBalance - capitalDelta}
              WHERE id = ${payload.seller_id}
            `;
          }
        }

        // ── 10. Treasury flagging for redemptions ──
        if (isRedemption) {
          const compName = (payload.company_name || "treasury").toLowerCase().trim();
          const treasurySh = shareholders.find(
            (s: any) => s.name.toLowerCase().trim() === compName
          );
          if (treasurySh) {
            await tx`UPDATE shareholders SET is_treasury = true WHERE id = ${treasurySh.id}`;
          }
        }

        return {
          transactionId: txn.id,
          billId: bill.id,
          certActions,
          buyerShareholderId: buyerShId,
        };
      });

      await sql.end();

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (dbErr: any) {
      await sql.end();
      console.error("Atomic transaction failed, rolled back:", dbErr);
      return new Response(
        JSON.stringify({
          error: "Transaction failed — all changes rolled back. " + (dbErr.message || "Unknown error"),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err: any) {
    console.error("execute-share-transfer error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
