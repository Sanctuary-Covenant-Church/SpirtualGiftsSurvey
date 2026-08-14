import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('Core User Journeys (Non-Admin)', () => {
  it('Journey 1: Landing Page -> Begins Spiritual Assessment', async () => {
    render(<App />);

    // Check Landing Page hero text
    expect(screen.getByText(/Discover How God Wired You/i)).toBeInTheDocument();
    
    // Find CTA button to start survey
    const startButtons = screen.getAllByRole('button', { name: /Begin Spiritual Gifts Assessment/i });
    expect(startButtons.length).toBeGreaterThan(0);

    // Click start survey
    fireEvent.click(startButtons[0]);

    // Verify view navigated to Survey Questionnaire
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Spiritual Gifts Assessment/i })).toBeInTheDocument();
    });
  });

  it('Journey 2: Survey Questionnaire -> Selection, Navigation & Previous Question', async () => {
    render(<App />);

    // Start Survey
    const startButtons = screen.getAllByRole('button', { name: /Begin Spiritual Gifts Assessment/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Spiritual Gifts Assessment/i })).toBeInTheDocument();
    });

    // Select response score '5' for Question 1
    const option5Buttons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '5');
    expect(option5Buttons.length).toBeGreaterThan(0);
    fireEvent.click(option5Buttons[0]);

    // Click Prev Question button
    const prevButton = screen.getByRole('button', { name: /← Prev Question/i });
    expect(prevButton).toBeInTheDocument();
    fireEvent.click(prevButton);

    // Verify still on survey view
    expect(screen.getByRole('heading', { name: /Spiritual Gifts Assessment/i })).toBeInTheDocument();
  });

  it('Journey 3: Header Navigation -> Switch between Home and Survey View', async () => {
    render(<App />);

    // Header Home link
    const homeNavButtons = screen.getAllByRole('button', { name: /Discovery Home/i });
    expect(homeNavButtons.length).toBeGreaterThan(0);

    // Header Survey link
    const surveyNavButtons = screen.getAllByRole('button', { name: /Spiritual Gifts Assessment/i });
    expect(surveyNavButtons.length).toBeGreaterThan(0);

    // Click Survey link
    fireEvent.click(surveyNavButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Spiritual Gifts Assessment/i })).toBeInTheDocument();
    });

    // Click Discovery Home link to return to landing hero
    fireEvent.click(homeNavButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Discover How God Wired You/i)).toBeInTheDocument();
    });
  });

  it('Journey 4: Survey Completion -> Submission Modal, Results Page & Retaking Assessment', async () => {
    render(<App />);

    // Navigate to Survey
    const startButtons = screen.getAllByRole('button', { name: /Begin Spiritual Gifts Assessment/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Spiritual Gifts Assessment/i })).toBeInTheDocument();
    });

    // Complete all questions loop
    for (let i = 0; i < 40; i++) {
      const option5Buttons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '5');
      if (option5Buttons.length > 0) {
        fireEvent.click(option5Buttons[0]);
      } else {
        break;
      }
    }

    // Verify "Final Step" modal prompt appears
    await waitFor(() => {
      expect(screen.getByText(/Final Step/i)).toBeInTheDocument();
    });

    // Fill in name and email address
    const nameInput = screen.getByPlaceholderText(/NAME/i);
    const emailInput = screen.getByPlaceholderText(/EMAIL ADDRESS/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Member' } });
    fireEvent.change(emailInput, { target: { value: 'jane@example.com' } });

    // Click "Reveal Results"
    const submitButton = screen.getByRole('button', { name: /Reveal Results/i });
    fireEvent.click(submitButton);

    // Verify Results View appears with Top 5 Spiritual Gifts
    await waitFor(() => {
      expect(screen.getByText(/Top 5 Spiritual Gifts Matches/i)).toBeInTheDocument();
    });

    // Look for Retake Survey button
    const retakeButton = screen.getByRole('button', { name: /Retake Assessment/i });
    expect(retakeButton).toBeInTheDocument();

    // Click Retake Survey
    fireEvent.click(retakeButton);

    // Verify reset to landing/initial state
    await waitFor(() => {
      expect(screen.getByText(/Discover How God Wired You/i)).toBeInTheDocument();
    });
  });
});
