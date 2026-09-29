import { z } from 'zod';

/*
 * Esquemas de las respuestas de Restobar, tomados del OpenAPI oficial y
 * limitados a los campos que usan las herramientas. Son tolerantes: un campo
 * con un tipo inesperado se convierte en `null` en lugar de romper la consulta.
 */

const str = z.string().nullish().catch(null);
const num = z.number().nullish().catch(null);
const bool = z.boolean().nullish().catch(null);
const id = z.string().catch('');
const obj = <T extends z.ZodRawShape>(shape: T) => z.looseObject(shape).nullish().catch(null);

export const Invoice = z.looseObject({
  _id: id,
  number: z.union([z.string(), z.number()]).nullish().catch(null),
  invoicePrefix: str,
  total: num,
  totalPaid: num,
  status: str,
  type: str,
  createdOn: str,
  table: obj({ idInternal: str, name: str }),
  client: obj({ idInternal: str, name: str, phone: str }),
  cashier: obj({ idInternal: str, name: str }),
  products: z
    .array(z.looseObject({ idInternal: str, name: str, quantity: num, price: num }))
    .nullish()
    .catch(null),
  delivery: obj({ isDelivery: bool, deliveryProvider: str }),
  deliveryCost: num,
  eInvoice: obj({ DIAN: obj({ dianState: str }) }),
  credit: obj({ dueDate: str }),
});
export type Invoice = z.infer<typeof Invoice>;

export const Product = z.looseObject({
  _id: id,
  name: str,
  category: str,
  barcode: str,
  type: str,
  isActive: bool,
  stock: num,
  stockMinimum: num,
  pricePurchase: num,
  locationsStock: z
    .array(
      z.looseObject({
        locationStock: str,
        isMain: bool,
        stock: num,
        stockMinimum: num,
        price: num,
      }),
    )
    .nullish()
    .catch(null),
});
export type Product = z.infer<typeof Product>;

export const Category = z.looseObject({ _id: id, name: str, description: str, isActive: bool });
export type Category = z.infer<typeof Category>;

export const Order = z.looseObject({
  _id: id,
  product: obj({ _id: str, name: str }),
  table: obj({ _id: str, name: str }),
  seller: obj({ _id: str, name: str, lastName: str }),
  quantity: num,
  unit_price: num,
  total: num,
  status: str,
  statusKitchen: str,
  complementary: bool,
  causeCancel: str,
  createdOn: str,
});
export type Order = z.infer<typeof Order>;

export const Client = z.looseObject({
  _id: id,
  name: str,
  lastName: str,
  isSocialReason: bool,
  documentName: str,
  document: str,
  checkDigit: z.union([z.number(), z.string()]).nullish().catch(null),
  email: str,
  phone: str,
  address: str,
  city: str,
  birthdate: str,
  points: num,
  createdOn: str,
});
export type Client = z.infer<typeof Client>;

export const PaymentMethod = z.looseObject({ _id: id, name: str });
export type PaymentMethod = z.infer<typeof PaymentMethod>;

/** Confirmado con la API real: el día viene en `_id.dayOfMonth`; no hay campo `date`. */
export const DaySales = z.looseObject({
  _id: obj({ dayOfMonth: str }),
  total: num,
  count: num,
});
export type DaySales = z.infer<typeof DaySales>;

/** Página de resultados. `count` es `null` si Restobar devolvió un arreglo sin total. */
export interface Page<T> {
  data: T[];
  count: number | null;
}

/** Acepta `{ data, count }` (con `pagination=true`) o un arreglo simple. */
export function parsePage<T extends z.ZodType>(item: T, body: unknown): Page<z.infer<T>> | null {
  const envelope = z.object({ data: z.array(item), count: z.number() }).safeParse(body);
  if (envelope.success) return envelope.data;
  const list = z.array(item).safeParse(body);
  if (list.success) return { data: list.data, count: null };
  return null;
}
