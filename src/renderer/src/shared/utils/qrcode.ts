function safeDecodeURIComponent(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

export function extractQRCodeToken(input: string): string {
  const normalized = input.trim()
  if (!normalized) {
    return ''
  }

  try {
    const url = new URL(normalized)
    const pathMatch = url.pathname.match(/\/q\/([^/?#]+)/i)
    if (pathMatch?.[1]) {
      return safeDecodeURIComponent(pathMatch[1]).trim()
    }

    const queryToken = url.searchParams.get('token')
    if (queryToken) {
      return queryToken.trim()
    }
  } catch {
    // Keep raw parsing branch.
  }

  const rawPathMatch = normalized.match(/\/q\/([^/?#]+)/i)
  if (rawPathMatch?.[1]) {
    return safeDecodeURIComponent(rawPathMatch[1]).trim()
  }

  if (/^qrcode:/i.test(normalized)) {
    return normalized.replace(/^qrcode:/i, '').trim()
  }

  return normalized
}
