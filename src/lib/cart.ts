export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

const TENANT_ID = import.meta.env.PUBLIC_TENANT_ID || 'consultorio';
const CART_KEY = `${TENANT_ID}_cart`;

function notify() {
  window.dispatchEvent(new CustomEvent('cart-updated'));
}

export function getCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  notify();
}

export function addToCart(item: { id: string; name: string; price: number }) {
  const cart = getCart();
  const existing = cart.find(i => i.id === item.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...item, quantity: 1 });
  }
  saveCart(cart);
}

export function removeFromCart(id: string) {
  saveCart(getCart().filter(i => i.id !== id));
}

export function updateQuantity(id: string, quantity: number) {
  if (quantity <= 0) return removeFromCart(id);
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (item) item.quantity = quantity;
  saveCart(cart);
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
  notify();
}

export function getCartTotal(): number {
  return getCart().reduce((sum, i) => sum + i.price * i.quantity, 0);
}

export function getCartCount(): number {
  return getCart().reduce((sum, i) => sum + i.quantity, 0);
}

export function generateWhatsAppUrl(phone: string): string {
  const cart = getCart();
  if (cart.length === 0) return '';

  const fmt = (n: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', minimumFractionDigits: 0,
  }).format(n);

  let msg = 'Hola! Me gustaria hacer el siguiente pedido:\n\n';
  for (const item of cart) {
    msg += `- ${item.name} x${item.quantity} - ${fmt(item.price * item.quantity)}\n`;
  }
  msg += `\n*Total: ${fmt(getCartTotal())}*`;
  msg += '\n\nGracias!';

  const cleanPhone = phone.replace(/\D/g, '');
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
}
