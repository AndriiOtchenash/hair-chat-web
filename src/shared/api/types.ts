import type { components } from './schema'

type Schemas = components['schemas']

export type MeResponse = Schemas['MeResponse']
export type UpdateMeRequest = Schemas['UpdateMeRequest']
export type UserRole = Schemas['UserRole']
export type Locale = Schemas['Locale']
export type ConsentType = Schemas['ConsentType']
export type ConsentItem = Schemas['ConsentItem']
export type ConsentsResponse = Schemas['ConsentsResponse']
export type GrantConsentsRequest = Schemas['GrantConsentsRequest']
