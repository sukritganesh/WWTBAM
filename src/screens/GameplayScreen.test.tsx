import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGameRun,
  currentQuestion,
  gameReducer,
  LADDER_LEVELS,
  resolveQuestionWithSeed,
  type FourChoices,
  type GameAction,
  type GameRunState,
  type LadderLevel,
  type QuestionDefinition,
} from '../game';
import { GameplayScreen } from './GameplayScreen';

afterEach(cleanup);

const choices: FourChoices = [
  { id: 'a', text: 'Alpha' },
  { id: 'b', text: 'Bravo' },
  { id: 'c', text: 'Charlie' },
  { id: 'd', text: 'Delta' },
];

function authoredQuestion(level: LadderLevel): QuestionDefinition {
  return {
    id: `gameplay-question-${level}`,
    level,
    category: 'Interaction Testing',
    prompt: `Which answer is correct at Level ${level}?`,
    choices,
    correctChoiceId: 'c',
    hint: `Consider Charlie at Level ${level}.`,
    explanation: `Charlie is the validated answer for Level ${level}.`,
    usage: { freshMix: true, setIds: [] },
  };
}

function createState(): GameRunState {
  let seed = 71;
  const questions = LADDER_LEVELS.map((level) => {
    const result = resolveQuestionWithSeed(authoredQuestion(level), seed);
    seed = result.nextSeed;
    return result.question;
  });

  return createGameRun({
    runId: 'gameplay-screen-run',
    owner: { kind: 'profile', profileId: 'player-1', displayName: 'Ada' },
    mode: { kind: 'fresh-mix' },
    questions,
    createdAtMs: 0,
  });
}

function reduce(state: GameRunState, ...actions: readonly GameAction[]): GameRunState {
  return actions.reduce(gameReducer, state);
}

function readyState(): GameRunState {
  return gameReducer(createState(), { type: 'SHOW_CURRENT_QUESTION' });
}

describe('GameplayScreen', () => {
  it('renders the run intro and all 15 prize rows before Question 1 is seen', () => {
    const onAction = vi.fn();
    render(<GameplayScreen state={createState()} nowMs={100} onAction={onAction} />);

    expect(screen.getByRole('heading', { name: /Ada, your path is secured/i })).toBeVisible();
    const ladder = screen.getByRole('complementary', { name: 'Prize ladder' });
    expect(within(ladder).getAllByRole('listitem')).toHaveLength(15);

    fireEvent.click(screen.getByRole('button', { name: 'Begin Question 1' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'SHOW_CURRENT_QUESTION' });
  });

  it('renders four labeled choices with stable IDs and supports mouse and A–D input', () => {
    const state = readyState();
    const onAction = vi.fn();
    render(<GameplayScreen state={state} nowMs={100} onAction={onAction} />);

    const group = screen.getByRole('group', { name: 'Answers for Question 1' });
    const answerButtons = within(group).getAllByRole('button');
    expect(answerButtons).toHaveLength(4);
    expect(answerButtons.map((button) => button.getAttribute('data-choice-id'))).toEqual(
      currentQuestion(state).choices.map((choice) => choice.id),
    );
    expect(answerButtons.map((button) => button.getAttribute('data-state'))).toEqual([
      'available',
      'available',
      'available',
      'available',
    ]);

    fireEvent.click(answerButtons[0]);
    expect(onAction).toHaveBeenCalledWith({
      type: 'SELECT_ANSWER',
      choiceId: currentQuestion(state).choices[0].id,
    });

    fireEvent.keyDown(window, { key: 'd' });
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'SELECT_ANSWER',
      choiceId: currentQuestion(state).choices[3].id,
    });
  });

  it('shows exact final-answer copy and emits a timestamped confirmation', () => {
    const ready = readyState();
    const choice = currentQuestion(ready).choices[1];
    const state = reduce(
      ready,
      { type: 'SELECT_ANSWER', choiceId: choice.id },
      { type: 'REQUEST_LOCK' },
    );
    const onAction = vi.fn();
    render(<GameplayScreen state={state} nowMs={4_242} onAction={onAction} />);

    const dialog = screen.getByRole('dialog', { name: 'Is that your final answer?' });
    expect(within(dialog).getByText(choice.label)).toBeVisible();
    expect(within(dialog).getByText(choice.text)).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Final Answer' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'CONFIRM_LOCK', nowMs: 4_242 });
  });

  it('uses text and icons as well as color for an incorrect reveal', () => {
    const ready = readyState();
    const question = currentQuestion(ready);
    const wrongChoice = question.choices.find(
      (choice) => choice.id !== question.correctChoiceId,
    );
    if (!wrongChoice) throw new Error('Test fixture requires a wrong choice.');

    const state = reduce(
      ready,
      { type: 'SELECT_ANSWER', choiceId: wrongChoice.id },
      { type: 'REQUEST_LOCK' },
      { type: 'CONFIRM_LOCK', nowMs: 20 },
      { type: 'REVEAL_ANSWER', nowMs: 21 },
    );
    const onAction = vi.fn();
    const view = render(
      <GameplayScreen state={state} nowMs={30} onAction={onAction} />,
    );

    expect(
      view.container.querySelector(`[data-choice-id="${wrongChoice.id}"]`),
    ).toHaveAttribute('data-state', 'incorrect');
    expect(
      view.container.querySelector(`[data-choice-id="${question.correctChoiceId}"]`),
    ).toHaveAttribute('data-state', 'correct');
    expect(screen.getByText('Your answer — incorrect')).toBeVisible();
    expect(screen.getByText('Correct answer')).toBeVisible();
    expect(screen.getByText(question.explanation)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Continue to results' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_TERMINAL' });
  });

  it('shows Hint and an absolute Phone countdown while disabling answer interaction', () => {
    const hinted = gameReducer(readyState(), { type: 'USE_HINT' });
    const hintView = render(
      <GameplayScreen state={hinted} nowMs={0} onAction={vi.fn()} />,
    );
    expect(screen.getByLabelText('Revealed hint')).toHaveTextContent(
      currentQuestion(hinted).hint,
    );
    hintView.unmount();

    const activePhone = reduce(
      readyState(),
      { type: 'REQUEST_PHONE' },
      { type: 'CONFIRM_PHONE', nowMs: 1_000 },
    );
    const onAction = vi.fn();
    render(<GameplayScreen state={activePhone} nowMs={11_000} onAction={onAction} />);

    expect(screen.getByRole('timer', { name: '50 seconds remaining' })).toHaveTextContent(
      '00:50',
    );
    const phoneAnswerButtons = within(
      screen.getByRole('group', { name: 'Answers for Question 1' }),
    ).getAllByRole('button');
    phoneAnswerButtons.forEach((button) => expect(button).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Pause game' })).toHaveAttribute(
      'title',
      'Pausing ends the call',
    );
    fireEvent.click(screen.getByRole('button', { name: 'End call early' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'END_PHONE_EARLY' });
  });

  it('supports narration replay/skip and makes a non-controlling tab read-only', () => {
    const onReplay = vi.fn();
    const onSkip = vi.fn();
    const onTakeControl = vi.fn();
    const onAction = vi.fn();
    const { rerender } = render(
      <GameplayScreen
        state={readyState()}
        nowMs={0}
        controllerStatus="read-only"
        narrationStatus="idle"
        onAction={onAction}
        onReplayNarration={onReplay}
        onSkipNarration={onSkip}
        onTakeControl={onTakeControl}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replay question' }));
    expect(onReplay).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Take control' }));
    expect(onTakeControl).toHaveBeenCalledOnce();
    expect(
      within(screen.getByRole('group', { name: 'Answers for Question 1' })).getAllByRole(
        'button',
      )[0],
    ).toBeDisabled();

    rerender(
      <GameplayScreen
        state={readyState()}
        nowMs={0}
        narrationStatus="speaking"
        onAction={onAction}
        onReplayNarration={onReplay}
        onSkipNarration={onSkip}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip voice' }));
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('renders Pause, Help, and Walk Away as controlled reducer overlays', () => {
    const paused = reduce(readyState(), { type: 'OPEN_PAUSE' });
    const onAction = vi.fn();
    const onSaveAndExit = vi.fn();
    render(
      <GameplayScreen
        state={paused}
        nowMs={900}
        onAction={onAction}
        onSaveAndExit={onSaveAndExit}
      />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Game paused' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'How to Play' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'OPEN_HELP' });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Save and Exit to Dashboard' }),
    );
    expect(onSaveAndExit).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Walk Away with $0' }));
    expect(onAction).toHaveBeenCalledWith({ type: 'REQUEST_WALK_AWAY' });
  });
});
