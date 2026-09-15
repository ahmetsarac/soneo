type ElementFullscreen = {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => void;
};

type VideoFullscreen = {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type DocumentFullscreen = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

export type FullscreenTarget =
  | { kind: "element"; via: "standard" | "webkit" }
  | { kind: "video-webkit" }
  | { kind: "none" };

export function pickFullscreenTarget(
  element: ElementFullscreen,
  video?: object | null,
): FullscreenTarget {
  if (typeof element.requestFullscreen === "function") {
    return { kind: "element", via: "standard" };
  }
  if (typeof element.webkitRequestFullscreen === "function") {
    return { kind: "element", via: "webkit" };
  }
  const webkitVideo = video as VideoFullscreen | null | undefined;
  if (typeof webkitVideo?.webkitEnterFullscreen === "function") {
    return { kind: "video-webkit" };
  }
  return { kind: "none" };
}

export function shouldReleaseFullscreen(presenting: boolean, hasLiveVideo: boolean) {
  return !presenting || !hasLiveVideo;
}

export function currentFullscreenElement(): Element | null {
  const doc = document as DocumentFullscreen;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isOurFullscreen(
  element: Element | null,
  video?: HTMLVideoElement | null,
) {
  if (element && currentFullscreenElement() === element) return true;
  return Boolean((video as VideoFullscreen | null | undefined)?.webkitDisplayingFullscreen);
}

export async function enterFullscreen(
  element: HTMLElement,
  video?: HTMLVideoElement | null,
) {
  const target = pickFullscreenTarget(element, video);
  if (target.kind === "element" && target.via === "standard") {
    await element.requestFullscreen();
    return;
  }
  if (target.kind === "element" && target.via === "webkit") {
    (element as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    return;
  }
  if (target.kind === "video-webkit" && video) {
    (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
  }
}

export async function exitFullscreen(video?: HTMLVideoElement | null) {
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  const doc = document as DocumentFullscreen;
  if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
    doc.webkitExitFullscreen();
    return;
  }
  const webkitVideo = video as VideoFullscreen | null | undefined;
  if (webkitVideo?.webkitDisplayingFullscreen && webkitVideo.webkitExitFullscreen) {
    webkitVideo.webkitExitFullscreen();
  }
}

export async function toggleFullscreen(
  element: HTMLElement,
  video?: HTMLVideoElement | null,
) {
  try {
    if (isOurFullscreen(element, video)) {
      await exitFullscreen(video);
      return;
    }
    await enterFullscreen(element, video);
  } catch {
    // gesture lost or the engine blocked fullscreen
  }
}

export function subscribeFullscreenChange(
  onChange: () => void,
  video?: HTMLVideoElement | null,
) {
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  video?.addEventListener("webkitbeginfullscreen", onChange);
  video?.addEventListener("webkitendfullscreen", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
    video?.removeEventListener("webkitbeginfullscreen", onChange);
    video?.removeEventListener("webkitendfullscreen", onChange);
  };
}
