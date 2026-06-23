// 로컬 설정(localStorage).
const DEV_KEY = 'harmony.devmode';
const FX_KEY = 'harmony.fxon';

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

// 제스처 효과음(탬버린/박수/헤드뱅잉) on/off. 기본 on.
export function getFxOn(): boolean {
  try {
    return localStorage.getItem(FX_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setFxOn(on: boolean): void {
  try {
    localStorage.setItem(FX_KEY, on ? '1' : '0');
  } catch {
    /* 저장 실패 무시 */
  }
}
