import type { BusinessType } from "../../../../config/Businesstypes.config"

export interface Tenant {
  id: number
  name: string
  type: BusinessType
}