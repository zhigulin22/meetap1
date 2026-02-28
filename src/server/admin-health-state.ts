let lastHealthErrorMessage: string | null = null;

export function setLastHealthError(message: string | null) {
  lastHealthErrorMessage = message;
}

export function getLastHealthError() {
  return lastHealthErrorMessage;
}
