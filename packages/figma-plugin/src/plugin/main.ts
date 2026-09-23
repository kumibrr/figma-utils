import type { Methods, RpcRequest, RpcResponse } from '../shared/messages';
import { readSnapshot } from './snapshot';
import { loadPrefs, loadToken, saveDestination, saveSettings, saveToken } from './storage';

type Handlers = {
  [K in keyof Methods]: (...params: Parameters<Methods[K]>) => ReturnType<Methods[K]> | Promise<ReturnType<Methods[K]>>;
};

const handlers: Handlers = {
  getSnapshot: () => readSnapshot(),
  getPrefs: () => loadPrefs(),
  saveSettings: (settings) => saveSettings(settings),
  saveToken: (token) => saveToken(token),
  getToken: () => loadToken(),
  saveDestination: (destination) => saveDestination(destination),
  openUrl: (url) => figma.openExternal(url),
  close: () => figma.closePlugin(),
};

figma.showUI(__html__, { width: 360, height: 440, themeColors: true, title: 'Export tokens' });

figma.ui.onmessage = async (message: RpcRequest) => {
  if (message?.rpc !== 'request') {
    return;
  }

  const reply: RpcResponse = { rpc: 'response', id: message.id };
  try {
    const handler = handlers[message.method] as (...params: unknown[]) => unknown;
    reply.result = await handler(...message.params);
  } catch (error) {
    reply.error = error instanceof Error ? error.message : String(error);
  }
  figma.ui.postMessage(reply);
};
