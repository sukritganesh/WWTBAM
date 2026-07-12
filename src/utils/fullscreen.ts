export async function toggleFullscreen(element: HTMLElement = document.documentElement): Promise<'entered' | 'exited' | 'unavailable'> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return 'exited';
    }
    if (!element.requestFullscreen) return 'unavailable';
    await element.requestFullscreen();
    return 'entered';
  } catch {
    return 'unavailable';
  }
}
