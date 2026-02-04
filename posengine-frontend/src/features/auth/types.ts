export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export interface OnboardingData {
  businessName: string
  businessType: string
  address: string
  phone: string
  currency: string
}
