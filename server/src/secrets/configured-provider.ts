import { SECRET_PROVIDERS, type SecretProvider } from "@dealdesk/shared";

export function getConfiguredSecretProvider(): SecretProvider {
  const configuredProvider = process.env.DEALDESK_SECRETS_PROVIDER;
  return configuredProvider && SECRET_PROVIDERS.includes(configuredProvider as SecretProvider)
    ? configuredProvider as SecretProvider
    : "local_encrypted";
}
