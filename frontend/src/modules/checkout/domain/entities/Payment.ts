export interface Payment {
  orderId: string;
  paymentId: string;
  status: string;
  statusDetail: string | null;
  amount: number;
  currency: string;
}
