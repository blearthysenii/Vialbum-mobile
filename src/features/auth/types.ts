export type AuthUser = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  bio: string | null;
  location: string | null;
  profile_photo_url: string | null;
  profile_cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileUpdateInput = Pick<AuthUser, 'first_name' | 'last_name' | 'username' | 'bio' | 'location'>;

export type AccessToken = {
  access_token: string;
  token_type: 'bearer';
};

export type SignUpInput = {
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  password: string;
};
