"use strict";

export function getDeviceContext() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  const isIPhone = /iPhone/i.test(ua);
  const isIPad =
    /iPad/i.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobileUA = /Mobi|Android|iPhone|iPod/i.test(ua);
  const isTouch = maxTouchPoints > 0;
  const isSmallScreen = window.matchMedia("(max-width: 900px)").matches;

  const isTablet =
    isIPad ||
    (isAndroid && !/Mobile/i.test(ua)) ||
    (isTouch && window.matchMedia("(min-width: 721px) and (max-width: 1180px)").matches);

  const isMobile =
    isIPhone ||
    (isAndroid && /Mobile/i.test(ua)) ||
    (isMobileUA && isSmallScreen);

  const isDesktop = !isMobile && !isTablet;

  return {
    isMobile,
    isTablet,
    isIPhone,
    isIPad,
    isAndroid,
    isTouch,
    isSmallScreen,
    isDesktop,
    preferCamera: isMobile || isTablet,
    preferUpload: isDesktop,
  };
}
