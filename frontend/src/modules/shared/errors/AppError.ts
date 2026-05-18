export class AppError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string, code = 'PAYMENT_ERROR') {
    super(message, code);
    this.name = 'PaymentError';
  }
}
