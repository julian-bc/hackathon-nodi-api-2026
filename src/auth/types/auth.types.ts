import { UserRoles } from 'src/user/types/user.types';

export type PayloadType = {
  sub: string;
  role: UserRoles;
  email: string;
};
