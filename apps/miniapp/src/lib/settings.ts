// 로컬 설정(localStorage). 현재는 개발자 모드 플래그만.
const DEV_KEY = 'harmony.devmode';

export function getDevMode(): boolean {
  try {
    return localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDevMode(on: boolean): void {
  try {
    localStorage.setItem(DEV_KEY, on ? '1' : '0');
  } catch {
    /* 저장 실패 무시 */
  }
}
