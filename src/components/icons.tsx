// One icon set for the whole app (Lucide). No emoji anywhere in the UI.
import {
  Banknote,
  CarTaxiFront,
  Hammer,
  Hand,
  House,
  Landmark,
  MessageCircle,
  Package,
  School,
  ShoppingBasket,
  Siren,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export const categoryIcons: Record<string, LucideIcon> = {
  hand: Hand,
  package: Package,
  house: House,
  hammer: Hammer,
  stethoscope: Stethoscope,
  banknote: Banknote,
  landmark: Landmark,
  school: School,
  basket: ShoppingBasket,
  taxi: CarTaxiFront,
  siren: Siren,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = categoryIcons[name] ?? MessageCircle;
  return <Icon aria-hidden="true" className={className} strokeWidth={2} />;
}
