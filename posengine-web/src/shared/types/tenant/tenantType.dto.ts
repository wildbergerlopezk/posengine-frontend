import type { BusinessType } from "../../../../config/Businesstypes.config"

export interface RegisterTenantDto {
  name: string;
  businessType: BusinessType
}
