import pathToRegex from 'path-to-regexp';
import { METHODS } from './router';
import * as actions from './actions';

export function matchRoute(path, routes) {
  let route;

  for (route of routes) {
    const [url, handler, name] = route;
    const reg = pathToRegex(url);
    const result = reg.exec(path);

    if (result) {
      return { handler, reg, result, name };
    }
  }
}

const getRouteInfo = (routes, shouldSetPage, data) => {
  const { method, pathName } = data;
  const route = matchRoute(pathName, routes);
  let routeInfo;

  if (route) {
    const { name } = route;

    if (name && shouldSetPage && method === METHODS.GET) {
      routeInfo = {
        name,
        startTime: new Date().getTime(),
      };
    }
  }
  return routeInfo;
};

const findAndCallHandler = (store, routes, shouldSetPage, data) => {
  const { method, pathName, queryParams, hashParams, bodyParams, referrer } = data;
  const { dispatch, getState } = store;
  const route = matchRoute(pathName, routes);

  if (route) {
    const { handler, reg, result } = route;
    const urlParams = reg.keys.reduce((prev, cur, index) => ({
      ...prev,
      [cur.name]: result[index + 1],
    }), {});

    if (shouldSetPage && method === METHODS.GET) {
      dispatch(actions.setPage(pathName, {
        urlParams,
        queryParams,
        hashParams,
        referrer,
      }));
    }

    const h = new handler(
      pathName,
      urlParams,
      queryParams,
      hashParams,
      bodyParams,
      dispatch,
      getState
    );

    return h[method].bind(h);
  }

  return new Error(`No route found for ${method} ${pathName}`);
};

export default {
  create(routes, well, onHandlerComplete) {
    return store => next => action => {
      let shouldSetPage;
      let payload;
      switch (action.type) {
        case actions.NAVIGATE_TO_URL:
        case actions.GOTO_PAGE_INDEX: {
          next(action);
          if (action.type === actions.NAVIGATE_TO_URL) {
            shouldSetPage = true;
            payload = action.payload;
          } else {
            shouldSetPage = false;
            payload = { ...action.payload, method: METHODS.GET };
          }
          const routeInfo = getRouteInfo(routes, shouldSetPage, payload);
          const handler = findAndCallHandler(store, routes, shouldSetPage, payload);
          const ret = next(handler);
          well.onComplete().then(onHandlerComplete(routeInfo));
          return ret;
        }
        default: return next(action);
      }
    };
  },
};
