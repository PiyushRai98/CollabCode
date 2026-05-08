import jwt, { SignOptions } from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { config } from '../config';
import { UserPayload } from '../types';

function signToken(user: IUser): string {
  const payload: UserPayload = {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  };
  const options: SignOptions = { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.secret, options);
}

export async function register(username: string, email: string, password: string) {
  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing) {
    throw new Error(existing.email === email ? 'Email already in use' : 'Username taken');
  }
  const user = await User.create({ username, email, password });
  return { user: user.toJSON(), token: signToken(user) };
}

export async function login(email: string, password: string) {
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new Error('Invalid email or password');
  }
  return { user: user.toJSON(), token: signToken(user) };
}

export function verifyToken(token: string): UserPayload {
  return jwt.verify(token, config.jwt.secret) as UserPayload;
}
