export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
};

export type AccessToken = {
  access_token: string;
  token_type: 'bearer';
};

export type SignUpInput = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};
