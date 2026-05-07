export interface CustomerResponseDto {
  id: string;
  name: string;
  document: string;
  type: string;
  email: string;
  phone: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}
