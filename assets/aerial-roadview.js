(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AerialRoadview = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const referenceUrl = "https://roadview-sync-360.hopesound.chatgpt.site/?dates=2024-06-20%2C2022-05-25%2C2019-05-25%2C&lat=35.63527643&lng=126.6617824&pan=266.29&tilt=6.11&zoom=3";
  const defaultPoint = Object.freeze({ latitude: 35.63527643, longitude: 126.6617824, title: "공유된 로드뷰 위치" });

  function buildUrl(point = defaultPoint) {
    const latitude = point?.latitude;
    const longitude = point?.longitude;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new TypeError("올바른 위도·경도가 필요합니다.");
    }
    const url = new URL(referenceUrl);
    url.searchParams.set("lat", latitude.toFixed(8));
    url.searchParams.set("lng", longitude.toFixed(8));
    return url.href;
  }

  return Object.freeze({ buildUrl, defaultPoint });
});
