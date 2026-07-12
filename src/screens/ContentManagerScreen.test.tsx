import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RawContentPack } from '../content';
import { ContentManagerScreen, type ContentManagerScreenProps } from './ContentManagerScreen';

afterEach(() => cleanup());

function validPoolPack(): RawContentPack {
  return {
    schemaVersion: '1.0.0',
    id: 'local-science-pack',
    title: 'Local Science',
    description: 'A small locally reviewed pack.',
    version: '1.0.0',
    language: 'en-US',
    contentType: 'pool',
    categories: ['Science'],
    questions: [
      {
        id: 'water-formula',
        level: 1,
        category: 'Science',
        tags: ['chemistry'],
        prompt: 'What is the chemical formula for water?',
        choices: [
          { id: 'a', text: 'CO2' },
          { id: 'b', text: 'H2O' },
          { id: 'c', text: 'O2' },
          { id: 'd', text: 'NaCl' }
        ],
        correctChoiceId: 'b',
        hint: 'Two hydrogen atoms bond to one oxygen atom.',
        explanation: 'Water has the chemical formula H2O.',
        usage: { freshMix: true, setIds: [] }
      }
    ],
    sets: [],
    metadata: {
      author: 'Test Author',
      questionCount: 1,
      reviewStatus: 'human-reviewed',
      humanReviewRecommended: false,
      timeSensitiveQuestionCount: 0
    }
  };
}

function setup(overrides: Partial<ContentManagerScreenProps> = {}) {
  const props: ContentManagerScreenProps = {
    installedPacks: [
      {
        id: 'community-history',
        title: 'Community History',
        description: 'A locally installed history collection.',
        version: '2.0.0',
        author: 'A. Curator',
        enabled: true,
        questionCount: 45,
        setCount: 1,
        categories: ['Ancient History', 'Modern History']
      },
      {
        id: 'kitchen-science',
        title: 'Kitchen Science',
        description: 'Food experiments and everyday chemistry.',
        version: '1.1.0',
        author: 'B. Author',
        enabled: false,
        questionCount: 20,
        setCount: 0,
        categories: ['Science', 'Food and Drink']
      }
    ],
    onBack: vi.fn(),
    onTogglePack: vi.fn(),
    onExportPack: vi.fn(),
    onDuplicatePack: vi.fn(),
    onRemovePack: vi.fn(),
    onCommitPack: vi.fn(),
    onDownloadText: vi.fn(),
    ...overrides
  };
  const user = userEvent.setup();
  render(<ContentManagerScreen {...props} />);
  return { props, user };
}

describe('ContentManagerScreen', () => {
  it('shows built-in coverage and filters/toggles repository-provided packs', async () => {
    const { props, user } = setup();
    expect(screen.getByText('480')).toBeInTheDocument();
    expect(screen.getByText('Community History')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Science')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search installed packs' }), 'history');
    expect(screen.getByText('Community History')).toBeInTheDocument();
    expect(screen.queryByText('Kitchen Science')).not.toBeInTheDocument();

    const historyCard = screen.getByText('Community History').closest('article');
    expect(historyCard).not.toBeNull();
    await user.click(within(historyCard!).getByRole('checkbox', { name: 'Use in new games' }));
    expect(props.onTogglePack).toHaveBeenCalledWith('community-history', false);
  });

  it('shows a rejected paste preview and never exposes it to the commit callback', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: /Import & templates/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Question-pack JSON' }), { target: { value: '{broken' } });
    await user.click(screen.getByRole('button', { name: 'Validate & preview' }));

    expect(screen.getByText('Pack rejected')).toBeInTheDocument();
    expect(screen.getByText(/Could not parse JSON/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import entire pack' })).toBeDisabled();
    expect(props.onCommitPack).not.toHaveBeenCalled();
  });

  it('previews and commits a whole valid pack through the repository callback', async () => {
    const onCommitPack = vi.fn();
    const { user } = setup({ onCommitPack });
    await user.click(screen.getByRole('button', { name: /Import & templates/i }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Question-pack JSON' }), {
      target: { value: JSON.stringify(validPoolPack()) }
    });
    await user.click(screen.getByRole('button', { name: 'Validate & preview' }));

    expect(screen.getByText('Ready for atomic commit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import entire pack' }));
    expect(onCommitPack).toHaveBeenCalledTimes(1);
    const payload = onCommitPack.mock.calls[0][0];
    expect(payload.pack.questions[0].id).toBe('local-science-pack:water-formula');
    expect(payload.pack.questions).toHaveLength(1);
  });

  it('exports authoring resources and saves a form-authored pool question', async () => {
    const onDownloadText = vi.fn();
    const onCommitPack = vi.fn();
    const { user } = setup({ onDownloadText, onCommitPack });
    await user.click(screen.getByRole('button', { name: /Import & templates/i }));
    await user.click(screen.getByRole('button', { name: /Blank schema template/i }));
    expect(onDownloadText).toHaveBeenCalledWith(
      'blank-question-pack.json',
      expect.stringContaining('"schemaVersion": "1.0.0"'),
      'application/json'
    );

    await user.click(screen.getByRole('button', { name: /Manual editor/i }));
    await user.click(screen.getByRole('button', { name: 'Add question' }));
    await user.type(screen.getByLabelText('Prompt'), 'Which planet is closest to the Sun?');
    await user.type(screen.getByLabelText('Choice A'), 'Venus');
    await user.type(screen.getByLabelText('Choice B'), 'Mercury');
    await user.type(screen.getByLabelText('Choice C'), 'Earth');
    await user.type(screen.getByLabelText('Choice D'), 'Mars');
    await user.click(screen.getByRole('radio', { name: /B/i }));
    await user.type(screen.getByLabelText('Handcrafted hint'), 'It has the shortest orbital period.');
    await user.type(screen.getByLabelText('Explanation'), 'Mercury is the innermost planet.');
    await user.click(screen.getByRole('button', { name: 'Save question' }));
    expect(screen.getByText('Which planet is closest to the Sun?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Validate & save pack' }));
    expect(onCommitPack).toHaveBeenCalledTimes(1);
    expect(onCommitPack.mock.calls[0][0].pack.questions).toHaveLength(1);
  });
});
