import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GitBranch, Building2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  entity_type: string;
}

interface Relationship {
  parent_company_id: string;
  child_company_id: string;
  relationship_type: string;
  ownership_percentage: number | null;
}

interface TreeNode {
  company: Company;
  children: { node: TreeNode; relationship: Relationship }[];
}

const entityColor = (type: string) => {
  switch (type) {
    case "Corporation": return "bg-primary/10 text-primary border-primary/20";
    case "S-Corp": return "bg-chart-2/10 text-chart-2 border-chart-2/20";
    case "LLC": return "bg-chart-3/10 text-chart-3 border-chart-3/20";
    case "Non-Profit": return "bg-chart-4/10 text-chart-4 border-chart-4/20";
    default: return "bg-muted text-muted-foreground border-muted";
  }
};

function OrgNode({ node, relationship, navigate }: { node: TreeNode; relationship?: Relationship; navigate: (path: string) => void }) {
  return (
    <li className="relative flex flex-col items-center">
      {/* Connector line from parent */}
      {relationship && (
        <div className="w-px h-6 bg-border" />
      )}
      {/* Node card */}
      <button
        onClick={() => navigate(`/company/${node.company.id}`)}
        className="group relative rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all min-w-[160px] max-w-[220px]"
      >
        <div className="font-medium text-xs truncate">{node.company.name}</div>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="outline" className={`text-[9px] px-1 py-0 ${entityColor(node.company.entity_type)}`}>
            {node.company.entity_type}
          </Badge>
          {relationship?.ownership_percentage != null && (
            <span className="text-[10px] text-muted-foreground">{relationship.ownership_percentage}%</span>
          )}
        </div>
      </button>

      {/* Children */}
      {node.children.length > 0 && (
        <>
          <div className="w-px h-6 bg-border" />
          <ul className="flex gap-8 relative">
            {/* Horizontal connector */}
            {node.children.length > 1 && (
              <div className="absolute top-0 left-[calc(50%-(var(--span)/2))] h-px bg-border"
                style={{
                  left: '50%',
                  width: `calc(100% - 160px)`,
                  transform: 'translateX(-50%)',
                }}
              />
            )}
            {node.children.map(({ node: child, relationship: rel }) => (
              <OrgNode key={child.company.id} node={child} relationship={rel} navigate={navigate} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

export default function OrgChart() {
  const navigate = useNavigate();

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, entity_type").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  const { data: relationships = [], isLoading: loadingRels } = useQuery({
    queryKey: ["company_relationships", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company_relationships").select("*").order("created_at");
      if (error) throw error;
      return data as Relationship[];
    },
  });

  const { roots, standalones } = useMemo(() => {
    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const childSet = new Set(relationships.map((r) => r.child_company_id));
    const childrenMap = new Map<string, { node: TreeNode; relationship: Relationship }[]>();

    // Build adjacency
    for (const rel of relationships) {
      if (!childrenMap.has(rel.parent_company_id)) {
        childrenMap.set(rel.parent_company_id, []);
      }
      const childCompany = companyMap.get(rel.child_company_id);
      if (childCompany) {
        childrenMap.get(rel.parent_company_id)!.push({
          node: { company: childCompany, children: [] },
          relationship: rel,
        });
      }
    }

    // Build trees recursively (with visited set to prevent cycles)
    const buildTree = (companyId: string, visited: Set<string>): TreeNode | null => {
      if (visited.has(companyId)) return null;
      visited.add(companyId);
      const company = companyMap.get(companyId);
      if (!company) return null;

      const children = (childrenMap.get(companyId) || []).map(({ node: childStub, relationship }) => {
        const fullChild = buildTree(childStub.company.id, new Set(visited));
        return {
          node: fullChild || childStub,
          relationship,
        };
      });

      return { company, children };
    };

    // Root companies: have children but are NOT children themselves, or have no relationships at all
    const parentIds = new Set(relationships.map((r) => r.parent_company_id));
    const rootCompanyIds = [...parentIds].filter((id) => !childSet.has(id));

    const roots: TreeNode[] = [];
    for (const rootId of rootCompanyIds) {
      const tree = buildTree(rootId, new Set());
      if (tree) roots.push(tree);
    }

    // Standalone = no relationships at all
    const involvedIds = new Set([...parentIds, ...childSet]);
    const standalones = companies.filter((c) => !involvedIds.has(c.id));

    return { roots, standalones };
  }, [companies, relationships]);

  const isLoading = loadingCompanies || loadingRels;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <GitBranch className="h-5 w-5 text-primary" />
        <h1 className="font-display text-xl font-bold tracking-tight">Entity Org Chart</h1>
      </div>

      {roots.length === 0 && standalones.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <Building2 className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No companies found. Add companies and define relationships to see the org chart.</p>
          </CardContent>
        </Card>
      )}

      {/* Trees */}
      {roots.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <GitBranch className="h-4 w-4" /> Ownership Hierarchies
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto pb-8">
            <div className="flex gap-16 justify-center min-w-max pt-4">
              {roots.map((root) => (
                <ul key={root.company.id} className="flex flex-col items-center">
                  <OrgNode node={root} navigate={navigate} />
                </ul>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Standalone entities */}
      {standalones.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Standalone Entities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {standalones.map((c) => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/company/${c.id}`)}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
                >
                  <div className="font-medium text-xs">{c.name}</div>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 mt-1 ${entityColor(c.entity_type)}`}>
                    {c.entity_type}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
