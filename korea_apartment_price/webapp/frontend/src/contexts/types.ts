import * as React from 'react';

export type UseState<STATE_NAME extends string, T> = {
  [key in STATE_NAME]: T;
} & {
  [key in `set${Capitalize<STATE_NAME>}`]: React.Dispatch<
    React.SetStateAction<T>
  >;
};
