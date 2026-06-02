import type { RuntimeEventHandler, RuntimeEventName, RuntimeEventPayload } from "./types.js";

type ListenerMap = {
  [TEventName in RuntimeEventName]?: Set<RuntimeEventHandler<TEventName>>;
};

/**
 * 런타임 내부 이벤트를 구독하고 발행하는 타입 안전 이벤트 버스를 만듭니다.
 */
export function createEventBus() {
  const listeners: ListenerMap = {};

  /**
   * 이벤트 이름에 핸들러를 등록하고 해제 함수를 반환합니다.
   */
  function on<TEventName extends RuntimeEventName>(
    eventName: TEventName,
    handler: RuntimeEventHandler<TEventName>,
  ) {
    const handlers = listeners[eventName] ?? new Set<RuntimeEventHandler<TEventName>>();
    handlers.add(handler);
    listeners[eventName] = handlers as ListenerMap[TEventName];

    return () => {
      handlers.delete(handler);
    };
  }

  /**
   * 이벤트 이름과 payload를 받아 등록된 핸들러를 실행합니다.
   */
  function emit<TEventName extends RuntimeEventName>(
    eventName: TEventName,
    payload = {} as RuntimeEventPayload<TEventName>,
  ) {
    const handlers = listeners[eventName] as Set<RuntimeEventHandler<TEventName>> | undefined;

    if (!handlers) {
      return;
    }

    handlers.forEach((handler) => handler(payload));
  }

  return {
    on,
    emit,
  };
}
