const globalLiveConfig =
  globalThis.__DRUM_BLONDE_LIVE_CONFIG__ ||
  (globalThis.__DRUM_BLONDE_LIVE_CONFIG__ = {
    twitchChannel: "drumdrumbrooke",
    isLiveOverride: false,
    showChat: true
  });

export const twitchChannel = globalLiveConfig.twitchChannel;
export const showChat = globalLiveConfig.showChat;
export let isLiveOverride = globalLiveConfig.isLiveOverride;

export function getLiveConfig() {
  isLiveOverride = globalLiveConfig.isLiveOverride;

  return {
    twitchChannel,
    isLiveOverride,
    showChat
  };
}

export function setLiveOverride(value) {
  globalLiveConfig.isLiveOverride = Boolean(value);
  isLiveOverride = globalLiveConfig.isLiveOverride;
  return getLiveConfig();
}
