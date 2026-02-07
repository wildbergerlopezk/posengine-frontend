export interface RegisterUserDto {
  fullName: string
  email: string
  password: string
  tenantId?: number | null
}
