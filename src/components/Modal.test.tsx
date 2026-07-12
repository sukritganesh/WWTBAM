import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { Modal } from './Modal';

function ControlledProfileModal() {
  const [name, setName] = useState('');

  return (
    <Modal title="Create local profile" onClose={() => undefined}>
      <label>
        Display name
        <input
          aria-label="Display name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
    </Modal>
  );
}

describe('Modal', () => {
  it('keeps a controlled text field focused across parent rerenders', async () => {
    const user = userEvent.setup();
    render(<ControlledProfileModal />);
    const input = screen.getByRole('textbox', { name: 'Display name' });

    await user.click(input);
    await user.type(input, 'Ada');

    expect(input).toHaveValue('Ada');
    expect(input).toHaveFocus();
  });
});
