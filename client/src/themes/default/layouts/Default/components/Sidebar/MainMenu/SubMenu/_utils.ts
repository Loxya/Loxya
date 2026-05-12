import type { RawLocation, Route } from 'vue-router';
import type VueRouter from 'vue-router';

type RouteParamValue = string | string[] | undefined;
type RouteParams = Record<string, RouteParamValue>;

export type LocationState = {
    isActive: boolean,
    isExactActive: boolean,
};

const isEquivalentRouteParamArray = (a: string[], b: RouteParamValue): boolean => {
    if (Array.isArray(b)) {
        return (
            a.length === b.length &&
            a.every((value, index) => value === b[index])
        );
    }
    return b !== undefined && a.length === 1 && a[0] === b;
};

const isSameRouteLocationParamsValue = (a: RouteParamValue, b: RouteParamValue): boolean => {
    if (a === undefined || b === undefined) {
        return a === b;
    }

    if (Array.isArray(a)) {
        return isEquivalentRouteParamArray(a, b);
    }

    return Array.isArray(b)
        ? isEquivalentRouteParamArray(b, a)
        : a === b;
};

const isSameRouteLocationParams = (a: RouteParams, b: RouteParams): boolean => {
    const aKeys = Object.keys(a);
    if (aKeys.length !== Object.keys(b).length) {
        return false;
    }
    return aKeys.every((key) => isSameRouteLocationParamsValue(a[key], b[key]));
};

const isEqualsRouteLocationParams = (a: RouteParams, b: RouteParams): boolean => (
    Object.keys(a).every((key) => isSameRouteLocationParamsValue(a[key], b[key]))
);

const resolveActiveRecordIndex = (resolvedRoute: Route, currentMatched: Route['matched']): number => {
    const { matched } = resolvedRoute;

    const routeMatched = matched.at(-1);
    if (!routeMatched || currentMatched.length === 0) {
        return -1;
    }

    const index = currentMatched.indexOf(routeMatched);
    if (index > -1) {
        return index;
    }

    const parentRecord = currentMatched.at(-2);
    if (
        matched.length > 1 &&
        parentRecord &&
        routeMatched.parent &&
        parentRecord === routeMatched.parent
    ) {
        return currentMatched.indexOf(parentRecord);
    }

    return -1;
};

// See https://github.com/vuejs/vue-router/blob/v3.6.5/src/composables/useLink.js
export const getLocationStateFactory = (router: VueRouter, currentRoute: Route) => {
    const currentMatched = currentRoute.matched;

    return (location: RawLocation): LocationState => {
        const { route: resolvedRoute } = router.resolve(location, currentRoute);
        const activeRecordIndex = resolveActiveRecordIndex(resolvedRoute, currentMatched);

        const isActive = (
            activeRecordIndex > -1 &&
            isEqualsRouteLocationParams(
                resolvedRoute.params as RouteParams,
                currentRoute.params as RouteParams,
            )
        );

        const isExactActive = (
            activeRecordIndex > -1 &&
            activeRecordIndex === (currentMatched.length - 1) &&
            isSameRouteLocationParams(
                resolvedRoute.params as RouteParams,
                currentRoute.params as RouteParams,
            )
        );

        return { isActive, isExactActive };
    };
};
