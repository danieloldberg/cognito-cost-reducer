import { createHmac } from "crypto";

export const createBase64Hash = (input: string): string => {
  const hash = createHmac("sha256", input).digest("base64");
  return hash;
};

export const createSecureHash = (
  input: string,
  salt = process.env.SECRET_SALT || "default_salt" // TODO: Use a more secure salting method
): string => {
  const hash = createHmac("sha256", salt).update(input).digest("hex");
  return hash;
};

export const createClientRequestHash = (
  clientId: string,
  clientSecret: string,
  scope: string
) => {
  const hash = createSecureHash(`${clientId}${clientSecret}${scope}`);
  return hash;
};

// Generator for strong secured identifiers
export const generateIdentifier = (
  length: number
): { identifier: string; hash: string } => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const hash = createSecureHash(result);
  return {
    identifier: result,
    hash: hash,
  };
};
