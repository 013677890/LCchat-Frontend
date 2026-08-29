interface ClipboardWriter {
  writeText(text: string): Promise<void>
}

function resolveClipboardWriter(): ClipboardWriter | undefined {
  if (typeof window !== 'undefined' && window.api?.clipboard) {
    return window.api.clipboard
  }
  if (typeof navigator !== 'undefined') {
    const browserClipboard = (navigator as Navigator & { clipboard?: Clipboard }).clipboard
    if (browserClipboard) {
      return browserClipboard
    }
  }
  return undefined
}

export async function writeTextToClipboard(
  text: string,
  writer: ClipboardWriter | undefined = resolveClipboardWriter()
): Promise<void> {
  if (!writer) {
    throw new Error('当前环境不支持剪贴板写入')
  }
  await writer.writeText(text)
}
