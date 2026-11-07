export function download(text: string, filename: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = [...filename]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 200);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
