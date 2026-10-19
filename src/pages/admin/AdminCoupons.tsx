import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "../../lib/currency";
import { supabase } from "../../lib/supabase";
import Icon from "../../components/Icon";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_subtotal: number;
  active: boolean;
  expires_at: string | null;
  usage_limit: number | null;
  used_count: number;
};

function friendlyError(err: { code?: string; message: string }): string {
  if (err.code === "23505") return "Já existe um cupom com esse código.";
  if (err.code === "23514") {
    return "Valores inválidos: confira desconto, pedido mínimo e limite de usos.";
  }
  if (err.code === "42501") {
    return "Sem permissão. Entre com uma conta de administrador.";
  }
  if (err.code === "42P01" || err.code === "PGRST205") {
    return "A tabela de cupons não existe no banco. Falta aplicar a migration de cupons.";
  }
  return err.message;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("0");
  const [usageLimit, setUsageLimit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    setCoupons((data as Coupon[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!code.trim() || !discountValue) {
      setError("Informe o código e o valor do desconto.");
      return;
    }
    if (!(Number(discountValue) > 0)) {
      setError("O valor do desconto deve ser maior que zero.");
      return;
    }
    if (discountType === "percent" && Number(discountValue) > 100) {
      setError("Desconto percentual não pode passar de 100%.");
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: Number(discountValue),
      min_subtotal: Number(minSubtotal) || 0,
      usage_limit: usageLimit ? Number(usageLimit) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setSaving(false);

    if (insertError) {
      setError(friendlyError(insertError));
      return;
    }

    setCode("");
    setDiscountValue("");
    setMinSubtotal("0");
    setUsageLimit("");
    setExpiresAt("");
    load();
  }

  async function toggleActive(coupon: Coupon) {
    const previous = coupons;
    setCoupons((prev) =>
      prev.map((c) => (c.id === coupon.id ? { ...c, active: !c.active } : c)),
    );
    const { error: updateError } = await supabase
      .from("coupons")
      .update({ active: !coupon.active })
      .eq("id", coupon.id);
    if (updateError) {
      setCoupons(previous);
      setError(friendlyError(updateError));
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!confirm(`Excluir o cupom "${coupon.code}" permanentemente?`)) return;
    setError(null);
    const previous = coupons;
    setCoupons((prev) => prev.filter((c) => c.id !== coupon.id));
    const { error: deleteError } = await supabase
      .from("coupons")
      .delete()
      .eq("id", coupon.id);
    if (deleteError) {
      setCoupons(previous);
      setError(friendlyError(deleteError));
    }
  }

  return (
    <div>
      <form
        onSubmit={handleCreate}
        className="admin-panel mb-8 flex flex-col gap-4 p-6"
      >
        <h3 className="text-lg font-bold tracking-tight text-on-surface uppercase">
          Novo cupom
        </h3>
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            placeholder="Código (ex: BEMVINDO10)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <select
            value={discountType}
            onChange={(e) =>
              setDiscountType(e.target.value as "percent" | "fixed")
            }
            className="carved-well border-none bg-surface-dim px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50"
          >
            <option value="percent">% percentual</option>
            <option value="fixed">R$ fixo</option>
          </select>
          <Input
            placeholder={discountType === "percent" ? "Ex: 10" : "Ex: 20.00"}
            type="number"
            step="0.01"
            min="0"
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
          />
          <Input
            placeholder="Pedido mínimo (R$)"
            type="number"
            step="0.01"
            min="0"
            value={minSubtotal}
            onChange={(e) => setMinSubtotal(e.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          <Input
            placeholder="Limite de usos (opcional)"
            type="number"
            min="1"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
          />
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="carved-well border-none bg-surface-dim px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary/50"
          />
          <Button type="submit" disabled={saving} className="md:col-span-2">
            {saving ? "Salvando..." : "Criar cupom"}
          </Button>
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
      </form>

      {loading ? (
        <div className="h-32 animate-pulse bg-surface-container-lowest" />
      ) : coupons.length === 0 ? (
        <div className="admin-panel flex flex-col items-center gap-4 px-8 py-20 text-center">
          <Icon name="receipt" className="text-4xl text-secondary opacity-60" />
          <p className="text-on-surface-variant">Nenhum cupom criado ainda.</p>
        </div>
      ) : (
        <div className="admin-panel overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/15 bg-surface-container/30 text-label-caps text-on-surface-variant uppercase">
                <th className="py-4 pr-4 pl-6">Código</th>
                <th className="py-4 pr-4">Desconto</th>
                <th className="py-4 pr-4">Mínimo</th>
                <th className="py-4 pr-4">Uso</th>
                <th className="py-4 pr-4">Validade</th>
                <th className="py-4 pr-4">Status</th>
                <th className="py-4 pr-6">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr
                  key={coupon.id}
                  className="admin-row-hover border-b border-outline-variant/10 text-on-surface last:border-0"
                >
                  <td className="py-3 pr-4 pl-6 font-medium">{coupon.code}</td>
                  <td className="py-3 pr-4 text-secondary">
                    {coupon.discount_type === "percent"
                      ? `${coupon.discount_value}%`
                      : formatBRL(coupon.discount_value)}
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {coupon.min_subtotal > 0
                      ? formatBRL(coupon.min_subtotal)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {coupon.used_count}
                    {coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
                  </td>
                  <td className="py-3 pr-4 text-on-surface-variant">
                    {coupon.expires_at
                      ? new Date(coupon.expires_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => toggleActive(coupon)}
                      className={`text-xs uppercase tracking-wide hover:underline ${
                        coupon.active
                          ? "text-secondary"
                          : "text-on-surface-variant/50"
                      }`}
                    >
                      {coupon.active ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="py-3 pr-6 text-right">
                    <button
                      onClick={() => deleteCoupon(coupon)}
                      aria-label={`Excluir cupom ${coupon.code}`}
                      className="text-on-surface-variant hover:text-error"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
