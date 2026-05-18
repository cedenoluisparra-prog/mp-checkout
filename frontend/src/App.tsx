import { ErrorBoundary } from './modules/checkout/presentation/components/ErrorBoundary/ErrorBoundary';
import { PaymentForm } from './modules/checkout/presentation/components/PaymentForm/PaymentForm';

export default function App() {
  return (
    <ErrorBoundary>
      <PaymentForm />
    </ErrorBoundary>
  );
}
