"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getToken,
  clearToken,
  searchContragents,
  getWarehouses,
  getPayboxes,
  getOrganizations,
  getPriceTypes,
  getNomenclature,
  createSale,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Phone,
  Trash2,
  LogOut,
  Plus,
  Minus,
  ShoppingCart,
  Loader2,
  User,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Named {
  id: number;
  name?: string;
  title?: string;
}

interface Contragent extends Named {
  phone?: string;
}

interface Nomenclature extends Named {
  prices?: Record<string, number>;
  price?: number;
  price_types?: Record<string, number>;
}

interface OrderItem {
  nomenclature_id: number;
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function label(item: Named): string {
  return item.name || item.title || String(item.id);
}

function getPriceForType(item: Nomenclature, priceTypeId: string): number {
  if (item.prices && priceTypeId && item.prices[priceTypeId] !== undefined) {
    return item.prices[priceTypeId];
  }
  if (item.price_types && priceTypeId && item.price_types[priceTypeId] !== undefined) {
    return item.price_types[priceTypeId];
  }
  return item.price ?? 0;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrderPage() {
  const router = useRouter();

  // Reference data
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [payboxes, setPayboxes] = useState<Named[]>([]);
  const [organizations, setOrganizations] = useState<Named[]>([]);
  const [priceTypes, setPriceTypes] = useState<Named[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // Customer
  const [phone, setPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [contragent, setContragent] = useState<Contragent | null>(null);
  const [contragentNotFound, setContragentNotFound] = useState(false);

  // Form selections
  const [payboxId, setPayboxId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [priceTypeId, setPriceTypeId] = useState("");
  const [comment, setComment] = useState("");

  // Products
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<Nomenclature[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // ── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
    }
  }, [router]);

  // ── Load reference data ────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [wh, pb, org, pt] = await Promise.all([
          getWarehouses(),
          getPayboxes(),
          getOrganizations(),
          getPriceTypes(),
        ]);
        setWarehouses(wh as Named[]);
        setPayboxes(pb as Named[]);
        setOrganizations(org as Named[]);
        setPriceTypes(pt as Named[]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Ошибка загрузки данных";
        toast.error(msg);
      } finally {
        setLoadingRef(false);
      }
    }
    if (getToken()) load();
  }, []);

  // ── Customer search ────────────────────────────────────────────────────────

  const handlePhoneSearch = async () => {
    if (!phone.trim()) return;
    setSearching(true);
    setContragent(null);
    setContragentNotFound(false);
    try {
      const results = await searchContragents(phone.trim());
      if (results.length > 0) {
        setContragent(results[0] as Contragent);
        setContragentNotFound(false);
      } else {
        setContragentNotFound(true);
      }
    } catch {
      toast.error("Ошибка поиска клиента");
    } finally {
      setSearching(false);
    }
  };

  // ── Product search with debounce ───────────────────────────────────────────

  const handleProductSearchChange = useCallback(
    (value: string) => {
      setProductSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setProductResults([]);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        setSearchingProducts(true);
        try {
          const results = await getNomenclature(value.trim());
          setProductResults(results as Nomenclature[]);
        } catch {
          toast.error("Ошибка поиска товаров");
        } finally {
          setSearchingProducts(false);
        }
      }, 300);
    },
    []
  );

  const addProduct = (item: Nomenclature) => {
    const exists = orderItems.find((o) => o.nomenclature_id === item.id);
    if (exists) {
      toast.info(`"${label(item)}" уже добавлен`);
      return;
    }
    const price = getPriceForType(item, priceTypeId);
    const newItem: OrderItem = {
      nomenclature_id: item.id,
      name: label(item),
      quantity: 1,
      price,
      amount: price,
    };
    setOrderItems((prev) => [...prev, newItem]);
    setProductSearch("");
    setProductResults([]);
  };

  const updateQuantity = (idx: number, qty: number) => {
    if (qty < 0) return;
    setOrderItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, quantity: qty, amount: qty * item.price }
          : item
      )
    );
  };

  const updatePrice = (idx: number, price: number) => {
    setOrderItems((prev) =>
      prev.map((item, i) =>
        i === idx
          ? { ...item, price, amount: item.quantity * price }
          : item
      )
    );
  };

  const removeItem = (idx: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Running total ──────────────────────────────────────────────────────────

  const total = orderItems.reduce((sum, item) => sum + item.amount, 0);

  // ── Submission ─────────────────────────────────────────────────────────────

  const handleSubmit = async (isConducted: boolean) => {
    if (!payboxId) { toast.error("Выберите счёт (кассу)"); return; }
    if (!organizationId) { toast.error("Выберите организацию"); return; }
    if (!warehouseId) { toast.error("Выберите склад"); return; }
    if (!priceTypeId) { toast.error("Выберите тип цены"); return; }
    if (orderItems.length === 0) { toast.error("Добавьте хотя бы один товар"); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        paybox_id: Number(payboxId),
        organization: Number(organizationId),
        warehouse: Number(warehouseId),
        price_type: Number(priceTypeId),
        is_conducted: isConducted,
        comment: comment.trim() || undefined,
        goods: orderItems.map((item) => ({
          nomenclature: item.nomenclature_id,
          quantity: item.quantity,
          price: item.price,
          price_type: Number(priceTypeId),
        })),
      };
      if (contragent?.id) payload.contragent = contragent.id;

      const result = await createSale(payload);
      const docNum = result?.number || result?.id || "";
      toast.success(
        `Продажа ${docNum ? `#${docNum}` : ""} ${isConducted ? "создана и проведена" : "создана"}`
      );
      // Reset form
      setPhone("");
      setContragent(null);
      setContragentNotFound(false);
      setOrderItems([]);
      setComment("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка создания продажи";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    router.push("/");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loadingRef) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-semibold text-gray-900">Новый заказ</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </button>
        </div>
      </header>

      {/* ── Form body ──────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-36 space-y-4">

        {/* 1. Phone / Customer */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Phone className="h-4 w-4 text-blue-600" />
              Клиент
            </div>
            <div className="flex gap-2">
              <Input
                type="tel"
                placeholder="+7 (999) 000-00-00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePhoneSearch()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handlePhoneSearch}
                disabled={searching || !phone.trim()}
                className="shrink-0"
              >
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {contragent && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
                <User className="h-4 w-4 shrink-0" />
                <span className="font-medium">{label(contragent)}</span>
              </div>
            )}
            {contragentNotFound && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                <UserX className="h-4 w-4 shrink-0" />
                <span>Клиент не найден</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Payboxes – horizontal scroll tabs */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <Label className="text-sm font-medium text-gray-700">Счёт (касса) *</Label>
            {payboxes.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                {payboxes.map((pb) => {
                  const active = payboxId === String(pb.id);
                  return (
                    <button
                      key={pb.id}
                      onClick={() => setPayboxId(String(pb.id))}
                      className={`snap-start shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                    >
                      {label(pb)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Нет данных</p>
            )}
          </CardContent>
        </Card>

        {/* 3. Organization */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label className="text-sm font-medium text-gray-700">Организация *</Label>
            <Select value={organizationId} onValueChange={(v) => setOrganizationId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите организацию" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={String(org.id)}>
                    {label(org)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 4. Warehouse */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label className="text-sm font-medium text-gray-700">Склад *</Label>
            <Select value={warehouseId} onValueChange={(v) => setWarehouseId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите склад" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)}>
                    {label(wh)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* 5. Price type */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label className="text-sm font-medium text-gray-700">Тип цены *</Label>
            <div className="flex flex-wrap gap-2">
              {priceTypes.map((pt) => {
                const active = priceTypeId === String(pt.id);
                return (
                  <button
                    key={pt.id}
                    onClick={() => setPriceTypeId(String(pt.id))}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-blue-400"
                    }`}
                  >
                    {label(pt)}
                  </button>
                );
              })}
              {priceTypes.length === 0 && (
                <p className="text-sm text-gray-400">Нет данных</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 6. Products */}
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-gray-700">Товары *</Label>
              {orderItems.length > 0 && (
                <Badge variant="secondary">{orderItems.length} поз.</Badge>
              )}
            </div>

            {/* Product search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Поиск товара..."
                value={productSearch}
                onChange={(e) => handleProductSearchChange(e.target.value)}
                className="pl-9"
              />
              {searchingProducts && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
              )}
            </div>

            {/* Search results */}
            {productResults.length > 0 && (
              <div className="rounded-lg border bg-white shadow-sm max-h-48 overflow-y-auto divide-y">
                {productResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addProduct(item)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{label(item)}</span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {productSearch && productResults.length === 0 && !searchingProducts && (
              <p className="text-center text-sm text-gray-400 py-2">Товары не найдены</p>
            )}

            {/* Order items list */}
            {orderItems.length > 0 && (
              <div className="space-y-2 mt-1">
                <Separator />
                {orderItems.map((item, idx) => (
                  <div key={item.nomenclature_id} className="rounded-lg border bg-gray-50 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-gray-800 leading-tight">{item.name}</span>
                      <button
                        onClick={() => removeItem(idx)}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Quantity */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(idx, Math.max(1, item.quantity - 1))}
                          className="rounded border bg-white p-1 hover:bg-gray-100"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQuantity(idx, Math.max(1, Number(e.target.value)))}
                          className="w-12 rounded border px-1 py-1 text-center text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          className="rounded border bg-white p-1 hover:bg-gray-100"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Price */}
                      <div className="flex flex-1 items-center gap-1">
                        <span className="text-xs text-gray-400">×</span>
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => updatePrice(idx, Number(e.target.value))}
                          className="flex-1 rounded border px-2 py-1 text-sm text-right"
                        />
                        <span className="text-xs text-gray-400">₽</span>
                      </div>
                      {/* Amount */}
                      <span className="shrink-0 text-sm font-semibold text-gray-900 min-w-[60px] text-right">
                        {item.amount.toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  </div>
                ))}

                <Separator />
                <div className="flex items-center justify-between pt-1 px-1">
                  <span className="text-sm font-medium text-gray-600">Итого:</span>
                  <span className="text-lg font-bold text-gray-900">
                    {total.toLocaleString("ru-RU")} ₽
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 7. Comment */}
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Label className="text-sm font-medium text-gray-700">Комментарий</Label>
            <textarea
              placeholder="Необязательный комментарий к заказу..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </CardContent>
        </Card>
      </main>

      {/* ── Sticky bottom actions ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t shadow-lg">
        <div className="mx-auto max-w-lg flex gap-3 px-4 py-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Создать продажу
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
          >
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Создать и провести
          </Button>
        </div>
      </div>
    </div>
  );
}
