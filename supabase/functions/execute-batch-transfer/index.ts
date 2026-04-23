import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TransferItem {
  buyer_name: string;
  buyer_id: string | null;
  num_shares: number;
  price_per_share: number | null;
  total_consideration: number | null;
  consideration_type: string;
  transaction_type: string;
  resolution_id: string;
}

interface BatchPayload {
  company_id: string;
  company_name?: string;
  entity_type: string;
  seller_name: string;
  seller_id: string | null;
  share_class: string;
  transaction_date: string;
  meeting_id: string;
  transfers: TransferItem[];
}

const LLC_TYPES = ["LLC", "Single Member LLC", "LLC-S"];
const NUMERIC_SCALE = 10000;

function isLLCType(entityType: string): boolean {
  return LLC_TYPES.includes(entityType);
}

function mapTxTypeToEquityType(txType: string, _isLLC: boolean, consideration: number): string | null {
  if (txType === "initial_issuance") return "Original Issue";
  if (["authorized_issuance", "consideration_issuance"].includes(txType)) return "Consideration for Shares";
  if (["initial_contribution", "additional_contribution", "membership_issuance"].includes(txType)) return "Capital Contribution";
  if (txType === "subscription_issuance") return "Subscription Purchase";
  if (["transfer", "interest_transfer", "interest_assignment", "share_exchange"].includes(txType)) {
    return consideration > 0 ? "Transfer (Sale)" : "Transfer (Gift)";
  }
  if (["redemption", "reacquisition"].includes(txType)) return "Redemption";
  if (txType === "cancellation") return "Reclassification";
  return null;
}

function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "number" ? value : Number(String(value).replace(/,/g, "").trim());
  if (!Number.isFinite(normalized)) return null;
  return Math.round(normalized * NUMERIC_SCALE) / NUMERIC_SCALE;
}

function addNumeric(a: unknown, b: unknown): number {
  const left = Math.round((toNumeric(a) ?? 0) * NUMERIC_SCALE);
  const right = Math.round((toNumeric(b) ?? 0) * NUMERIC_SCALE);
  return (left + right) / NUMERIC_SCALE;
}

function subtractNumeric(a: unknown, b: unknown): number {
  const left = Math.round((toNumeric(a) ?? 0) * NUMERIC_SCALE);
  const right = Math.round((toNumeric(b) ?? 0) * NUMERIC_SCALE);
  return (left - right) / NUMERIC_SCALE;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const rawPayload = await req.json();

    // Validate required fields
    if (!rawPayload.company_id || !rawPayload.seller_name || !rawPayload.meeting_id) {
      return new Response(JSON.stringify({ error: "Missing required fields (company_id, seller_name, meeting_id)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(rawPayload.transfers) || rawPayload.transfers.length === 0) {
      return new Response(JSON.stringify({ error: "transfers array is required and must not be empty" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse numeric fields in each transfer
    const transfers: TransferItem[] = [];
    for (const t of rawPayload.transfers) {
      const numShares = toNumeric(t.num_shares);
      if (numShares === null || numShares <= 0) {
        return new Response(JSON.stringify({ error: `Invalid share amount for buyer ${t.buyer_name}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      transfers.push({
        buyer_name: t.buyer_name,
        buyer_id: t.buyer_id || null,
        num_shares: numShares,
        price_per_share: t.price_per_share != null && t.price_per_share !== "" ? toNumeric(t.price_per_share) : null,
        total_consideration: t.total_consideration != null && t.total_consideration !== "" ? toNumeric(t.total_consideration) : null,
        consideration_type: t.consideration_type || "cash",
        transaction_type: t.transaction_type || "transfer",
        resolution_id: t.resolution_id,
      });
    }

    const payload: BatchPayload = {
      company_id: rawPayload.company_id,
      company_name: rawPayload.company_name,
      entity_type: rawPayload.entity_type || "Corporation",
      seller_name: rawPayload.seller_name,
      seller_id: rawPayload.seller_id || null,
      share_class: rawPayload.share_class || "Common",
      transaction_date: rawPayload.transaction_date,
      meeting_id: rawPayload.meeting_id,
      transfers,
    };

    const isLLC = isLLCType(payload.entity_type);

    // Verify ownership
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: company, error: companyErr } = await adminClient
      .from("companies").select("id, user_id, name").eq("id", payload.company_id).single();

    if (companyErr || !company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Access denied: you do not own this company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(dbUrl, { max: 1 });

    try {
      const result = await sql.begin(async (tx: any) => {
        // Fetch shareholders and certificates once
        const shareholders = await tx`
          SELECT id, name, status, capital_account_balance
          FROM shareholders WHERE company_id = ${payload.company_id}
        `;
        const certificates = await tx`
          SELECT id, certificate_number, shareholder_id, share_class, num_shares, status, par_value, cancelled_date
          FROM stock_certificates WHERE company_id = ${payload.company_id}
          ORDER BY certificate_number
        `;

        let certOffset = 0;
        const getNextCertNum = () => {
          const maxExisting = certificates.length > 0
            ? Math.max(...certificates.map((c: any) => c.certificate_number))
            : 0;
          certOffset++;
          return maxExisting + certOffset;
        };

        const certActions: string[] = [];
        const results: { transactionId: string; billId: string; buyerName: string; resolutionId: string }[] = [];

        // Find seller
        const sellerSh = shareholders.find(
          (s: any) => s.name.toLowerCase().trim() === payload.seller_name.toLowerCase().trim()
        );
        if (!sellerSh) {
          throw new Error(`Seller "${payload.seller_name}" not found in shareholders`);
        }

        // Find seller's active cert for this share class
        const sellerCert = certificates.find(
          (c: any) => c.shareholder_id === sellerSh.id && c.share_class === payload.share_class && c.status === "active"
        );
        if (!sellerCert) {
          throw new Error(`No active certificate found for ${payload.seller_name} in ${payload.share_class}`);
        }

        const sellerCertShares = toNumeric(sellerCert.num_shares) ?? 0;
        const totalTransferShares = transfers.reduce((sum, t) => addNumeric(sum, t.num_shares), 0);

        if (totalTransferShares > sellerCertShares + 0.0001) {
          throw new Error(
            `Total transfer of ${totalTransferShares} exceeds ${payload.seller_name}'s holdings of ${sellerCertShares}`
          );
        }

        // ── 1. Cancel seller's active certificate ONCE ──
        const cancelReason = `Batch transfer of ${totalTransferShares} shares to ${transfers.length} buyer(s)`;
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
            ${sellerCertShares}, ${payload.transaction_date}, ${payload.seller_name}, NULL,
            ${sellerCert.id},
            ${`Cancelled Cert #${sellerCert.certificate_number} — batch transfer to ${transfers.length} buyer(s)`}
          )
        `;

        // ── 2. Process each transfer ──
        // Track buyer certs that we create within this batch to handle consolidation
        const buyerCertsCreated: Map<string, { certId: string; certNum: number; totalShares: number }> = new Map();

        for (const transfer of transfers) {
          // Insert share_transaction
          const [txn] = await tx`
            INSERT INTO share_transactions (
              company_id, transaction_type, shareholder_id, share_class,
              num_shares, price_per_share, total_consideration, consideration_type,
              transaction_date, from_shareholder, to_shareholder, meeting_id
            ) VALUES (
              ${payload.company_id}, ${transfer.transaction_type},
              ${payload.seller_id || sellerSh.id}, ${payload.share_class},
              ${transfer.num_shares}, ${transfer.price_per_share || null},
              ${transfer.total_consideration || null}, ${transfer.consideration_type},
              ${payload.transaction_date}, ${payload.seller_name},
              ${transfer.buyer_name}, ${payload.meeting_id}
            )
            RETURNING id
          `;

          // Insert bill_of_sale
          const batchEquityType = mapTxTypeToEquityType(transfer.transaction_type, isLLCType(payload.entity_type), transfer.total_consideration || 0);
          const [bill] = await tx`
            INSERT INTO bills_of_sale (
              company_id, seller_name, buyer_name, share_class,
              num_shares, price_per_share, total_price, sale_date,
              shareholder_id, transaction_id, equity_type
            ) VALUES (
              ${payload.company_id}, ${payload.seller_name}, ${transfer.buyer_name},
              ${payload.share_class}, ${transfer.num_shares},
              ${transfer.price_per_share || null}, ${transfer.total_consideration || null},
              ${payload.transaction_date}, ${payload.seller_id || sellerSh.id}, ${txn.id},
              ${batchEquityType}
            )
            RETURNING id
          `;

          // Link bill to transaction
          await tx`
            UPDATE share_transactions SET bill_of_sale_id = ${bill.id} WHERE id = ${txn.id}
          `;

          // Upsert buyer as shareholder if new
          let buyerSh = shareholders.find(
            (s: any) => s.name.toLowerCase().trim() === transfer.buyer_name.toLowerCase().trim()
          );
          let buyerShId = transfer.buyer_id || (buyerSh ? buyerSh.id : null);

          if (!buyerSh && transfer.buyer_name.trim()) {
            const [newSh] = await tx`
              INSERT INTO shareholders (company_id, name, status)
              VALUES (${payload.company_id}, ${transfer.buyer_name.trim()}, 'active')
              RETURNING id, name
            `;
            buyerSh = newSh;
            buyerShId = newSh.id;
            // Add to shareholders array so next transfer can find them
            shareholders.push(newSh);
          }

          if (buyerShId) {
            await tx`
              UPDATE share_transactions SET shareholder_id = ${buyerShId} WHERE id = ${txn.id}
            `;
          }

          // Issue/consolidate buyer certificate
          if (buyerSh) {
            const buyerKey = buyerSh.id;
            let buyerExistingShares = 0;

            // Check if we already created a cert for this buyer in this batch
            const batchCert = buyerCertsCreated.get(buyerKey);
            if (batchCert) {
              // Cancel the cert we created earlier in this batch
              buyerExistingShares = batchCert.totalShares;
              await tx`
                UPDATE stock_certificates
                SET status = 'cancelled', cancelled_date = ${payload.transaction_date},
                    cancelled_reason = ${`Consolidated — batch: received additional ${transfer.num_shares} shares from ${payload.seller_name}`}
                WHERE id = ${batchCert.certId}
              `;
              certActions.push(`Cancelled Cert #${batchCert.certNum} (${transfer.buyer_name}) for batch consolidation`);
            } else {
              // Check for pre-existing active cert from before this batch
              const existingCert = certificates.find(
                (c: any) => c.shareholder_id === buyerSh!.id && c.share_class === payload.share_class && c.status === "active"
              );
              if (existingCert) {
                buyerExistingShares = toNumeric(existingCert.num_shares) ?? 0;
                await tx`
                  UPDATE stock_certificates
                  SET status = 'cancelled', cancelled_date = ${payload.transaction_date},
                      cancelled_reason = ${`Consolidated — received ${transfer.num_shares} shares from ${payload.seller_name}`}
                  WHERE id = ${existingCert.id}
                `;
                certActions.push(`Cancelled Cert #${existingCert.certificate_number} (${transfer.buyer_name}) for consolidation`);
              }
            }

            const buyerTotalShares = addNumeric(transfer.num_shares, buyerExistingShares);
            const buyerCertNum = getNextCertNum();
            const [newBuyerCert] = await tx`
              INSERT INTO stock_certificates (
                company_id, certificate_number, shareholder_id, share_class,
                num_shares, issue_date
              ) VALUES (
                ${payload.company_id}, ${buyerCertNum}, ${buyerSh.id}, ${payload.share_class},
                ${buyerTotalShares}, ${payload.transaction_date}
              )
              RETURNING id
            `;
            certActions.push(`Issued Cert #${buyerCertNum} to ${transfer.buyer_name} for ${buyerTotalShares} shares`);

            // Track for potential consolidation within this batch
            buyerCertsCreated.set(buyerKey, {
              certId: newBuyerCert.id,
              certNum: buyerCertNum,
              totalShares: buyerTotalShares,
            });

            // Transfer ledger entry
            await tx`
              INSERT INTO share_transactions (
                company_id, transaction_type, shareholder_id, share_class,
                num_shares, transaction_date, from_shareholder, to_shareholder,
                certificate_id, notes
              ) VALUES (
                ${payload.company_id}, 'Transfer In', ${buyerSh.id}, ${payload.share_class},
                ${transfer.num_shares}, ${payload.transaction_date}, ${payload.seller_name}, ${transfer.buyer_name},
                ${newBuyerCert.id},
                ${`Batch transfer: ${transfer.num_shares} shares from ${payload.seller_name} via Cert #${sellerCert.certificate_number}`}
              )
            `;
          }

          // Update transaction with denormalized cert numbers
          const buyerCertInfo = buyerSh ? buyerCertsCreated.get(buyerSh.id) : null;
          await tx`
            UPDATE share_transactions SET
              issued_certificate_number = ${buyerCertInfo ? buyerCertInfo.certNum : null},
              surrendered_certificate_number = ${sellerCert.certificate_number}
            WHERE id = ${txn.id}
          `;

          // Link transaction to resolution
          await tx`
            UPDATE meeting_resolutions SET transaction_id = ${txn.id}
            WHERE id = ${transfer.resolution_id}
          `;

          results.push({
            transactionId: txn.id,
            billId: bill.id,
            buyerName: transfer.buyer_name,
            resolutionId: transfer.resolution_id,
          });
        }

        // ── 3. Seller remainder certificate ──
        const remainingShares = subtractNumeric(sellerCertShares, totalTransferShares);
        let sellerRemainder: number | null = null;

        if (remainingShares > 0.0001) {
          const remainCertNum = getNextCertNum();
          await tx`
            INSERT INTO stock_certificates (
              company_id, certificate_number, shareholder_id, share_class,
              num_shares, issue_date, par_value
            ) VALUES (
              ${payload.company_id}, ${remainCertNum}, ${sellerSh.id}, ${payload.share_class},
              ${remainingShares}, ${payload.transaction_date}, ${sellerCert.par_value}
            )
          `;

          // Reissuance ledger entry
          await tx`
            INSERT INTO share_transactions (
              company_id, transaction_type, shareholder_id, share_class,
              num_shares, transaction_date, from_shareholder, to_shareholder,
              notes
            ) VALUES (
              ${payload.company_id}, 'reissuance', ${sellerSh.id}, ${payload.share_class},
              ${remainingShares}, ${payload.transaction_date}, NULL, ${payload.seller_name},
              ${`Reissued Cert #${remainCertNum} to ${payload.seller_name} for remaining ${remainingShares} shares after batch transfer`}
            )
          `;

          certActions.push(`Issued Cert #${remainCertNum} to ${payload.seller_name} for ${remainingShares} shares (remainder)`);
          sellerRemainder = remainingShares;
        } else {
          // Mark seller inactive
          await tx`UPDATE shareholders SET status = 'inactive' WHERE id = ${sellerSh.id}`;
          certActions.push(`${payload.seller_name} marked as former shareholder (0 shares)`);
          sellerRemainder = 0;
        }

        // ── 4. LLC: recalculate ownership percentages once ──
        if (isLLC) {
          await tx`SELECT public.recalculate_ownership_percentages(${payload.company_id}::uuid)`;

          // Snapshot ownership_percent on all active LLC certs that don't yet have one.
          // Captures the % at issuance for reprints; legacy certs fall back to live calc.
          await tx`
            UPDATE stock_certificates sc
            SET ownership_percent_snapshot = s.ownership_percentage
            FROM shareholders s
            WHERE sc.shareholder_id = s.id
              AND sc.company_id = ${payload.company_id}
              AND sc.status = 'active'
              AND sc.ownership_percent_snapshot IS NULL
              AND s.ownership_percentage IS NOT NULL
          `;
        }

        // ── 5. LLC: update capital accounts once ──
        if (isLLC) {
          // For transfers, capital accounts of buyers increase, seller decreases
          for (const transfer of transfers) {
            const delta = transfer.total_consideration || 0;
            if (delta > 0) {
              const buyerSh = shareholders.find(
                (s: any) => s.name.toLowerCase().trim() === transfer.buyer_name.toLowerCase().trim()
              );
              if (buyerSh) {
                const [sh] = await tx`SELECT capital_account_balance FROM shareholders WHERE id = ${buyerSh.id}`;
                const currentBalance = toNumeric(sh?.capital_account_balance) ?? 0;
                await tx`
                  UPDATE shareholders SET capital_account_balance = ${addNumeric(currentBalance, delta)}
                  WHERE id = ${buyerSh.id}
                `;
              }
            }
          }
        }

        return { results, certActions, sellerRemainder };
      });

      await sql.end();

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (dbErr: any) {
      await sql.end();
      console.error("Batch transaction failed, rolled back:", dbErr);
      return new Response(
        JSON.stringify({
          error: "Batch transaction failed — all changes rolled back. " + (dbErr.message || "Unknown error"),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("execute-batch-transfer error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
