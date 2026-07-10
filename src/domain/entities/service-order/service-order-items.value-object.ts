export interface ServiceItem {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface PartItem {
  partId: string;
  partName: string;
  partCode: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}
