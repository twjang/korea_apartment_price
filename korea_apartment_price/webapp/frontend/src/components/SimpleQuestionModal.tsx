import * as MUI from '@mui/material';
import * as React from 'react';

export interface Choice {
  button: JSX.Element;
  handler?: () => unknown;
}

interface SimpleQuestionModalProp {
  title?: JSX.Element;
  body?: JSX.Element;
  choices: Choice[];
  handleClose?: () => unknown;
  open: boolean;
}

const SimpleQuestionModal: React.FC<SimpleQuestionModalProp> = (
  prop: SimpleQuestionModalProp
) => {
  return (
    <MUI.Dialog
      open={prop.open}
      onClose={prop.handleClose}
      aria-labelledby="scroll-dialog-title"
      aria-describedby="scroll-dialog-description"
      maxWidth={'xl'}
      fullWidth={true}
    >
      <MUI.DialogTitle id="scroll-dialog-title">{prop.title}</MUI.DialogTitle>
      <MUI.DialogContent>
        <MUI.DialogContentText id="scroll-dialog-description" tabIndex={-1}>
          {prop.body}
        </MUI.DialogContentText>
      </MUI.DialogContent>
      <MUI.DialogActions>
        {prop.choices.map((e, idx) => {
          const handler = e.handler;
          return (
            <MUI.Button
              key={`${e.button.toString()}-${idx}`}
              onClick={() => {
                if (handler) handler();
                if (prop.handleClose) prop.handleClose();
              }}
            >
              {e.button}
            </MUI.Button>
          );
        })}
      </MUI.DialogActions>
    </MUI.Dialog>
  );
};

export interface SimpleQuestionModalCtxProp {
  openModal: (prop: {
    title?: JSX.Element;
    body?: JSX.Element;
    choices: Choice[];
    handleClose?: () => unknown;
  }) => unknown;
}

export const SimpleQuestionModalContext = React.createContext(
  {} as SimpleQuestionModalCtxProp
);

export const SimpleQuestionModalProvider: React.FC<{
  children?: (JSX.Element | null)[] | JSX.Element;
}> = ({ children }) => {
  const [open, setOpen] = React.useState<boolean>(false);
  const [title, setTitle] = React.useState<JSX.Element | undefined>(undefined);
  const [body, setBody] = React.useState<JSX.Element | undefined>(undefined);
  const [choices, setChoices] = React.useState<Choice[]>([]);
  const [userHandleClose, setUserHandleClose] = React.useState<
    (() => unknown) | null
  >(null);

  const openModal = (prop: {
    title?: JSX.Element;
    body?: JSX.Element;
    choices: Choice[];
    handleClose?: () => unknown;
  }) => {
    setTitle(prop.title);
    setBody(prop.body);
    setChoices(prop.choices);
    if (prop.handleClose) setUserHandleClose(prop.handleClose);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (userHandleClose) userHandleClose();
  };

  return (
    <>
      <SimpleQuestionModalContext.Provider
        value={{
          openModal,
        }}
      >
        {children}
        <SimpleQuestionModal
          title={title}
          body={body}
          open={open}
          choices={choices}
          handleClose={handleClose}
        />
      </SimpleQuestionModalContext.Provider>
    </>
  );
};

export const useSimpleQuestionModal = (): SimpleQuestionModalCtxProp => {
  return React.useContext(SimpleQuestionModalContext);
};
