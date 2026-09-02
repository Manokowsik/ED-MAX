import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Pure component for testing Quiz Result display behavior
function QuizResultBadge({ score, passingScore }) {
  const passed = score >= passingScore;
  return (
    <div data-testid="quiz-result" className={`badge ${passed ? 'badge-success' : 'badge-danger'}`}>
      <span data-testid="score-text">{score}%</span>
      <span data-testid="status-text">{passed ? 'PASSED' : 'FAILED'}</span>
    </div>
  );
}

// Pure component for testing Module Progress display
function ModuleProgressCard({ title, completed, score }) {
  return (
    <div data-testid="module-card">
      <h3>{title}</h3>
      <div data-testid="status">{completed ? 'Completed' : 'In Progress'}</div>
      {score !== null && score !== undefined && (
        <div data-testid="score">Score: {score}%</div>
      )}
    </div>
  );
}

// Pure component for testing Certificate Badge rendering
function CertificateBadge({ certNumber, studentName, courseTitle, finalScore }) {
  return (
    <div data-testid="certificate-card">
      <div data-testid="cert-number">{certNumber}</div>
      <div data-testid="student-name">{studentName}</div>
      <div data-testid="course-title">{courseTitle}</div>
      <div data-testid="final-score">{finalScore}%</div>
    </div>
  );
}

describe('Frontend Learning Flow Components', () => {
  describe('QuizResultBadge', () => {
    it('renders PASSED status and success styling when score exceeds passing threshold', () => {
      render(<QuizResultBadge score={85} passingScore={70} />);

      expect(screen.getByTestId('status-text')).toHaveTextContent('PASSED');
      expect(screen.getByTestId('score-text')).toHaveTextContent('85%');
      expect(screen.getByTestId('quiz-result')).toHaveClass('badge-success');
    });

    it('renders FAILED status and danger styling when score is below passing threshold', () => {
      render(<QuizResultBadge score={50} passingScore={70} />);

      expect(screen.getByTestId('status-text')).toHaveTextContent('FAILED');
      expect(screen.getByTestId('score-text')).toHaveTextContent('50%');
      expect(screen.getByTestId('quiz-result')).toHaveClass('badge-danger');
    });
  });

  describe('ModuleProgressCard', () => {
    it('renders completed status when module progress is finished', () => {
      render(<ModuleProgressCard title="Module 1: HTTP Protocols" completed={true} score={90} />);

      expect(screen.getByText('Module 1: HTTP Protocols')).toBeInTheDocument();
      expect(screen.getByTestId('status')).toHaveTextContent('Completed');
      expect(screen.getByTestId('score')).toHaveTextContent('Score: 90%');
    });

    it('renders in progress status when module is incomplete', () => {
      render(<ModuleProgressCard title="Module 2: FastAPI Architecture" completed={false} score={null} />);

      expect(screen.getByTestId('status')).toHaveTextContent('In Progress');
      expect(screen.queryByTestId('score')).not.toBeInTheDocument();
    });
  });

  describe('CertificateBadge', () => {
    it('renders full certificate metadata accurately', () => {
      render(
        <CertificateBadge
          certNumber="CERT-101-50-ABC12345"
          studentName="Jane Doe"
          courseTitle="Full-Stack Web Masterclass"
          finalScore={95}
        />
      );

      expect(screen.getByTestId('cert-number')).toHaveTextContent('CERT-101-50-ABC12345');
      expect(screen.getByTestId('student-name')).toHaveTextContent('Jane Doe');
      expect(screen.getByTestId('course-title')).toHaveTextContent('Full-Stack Web Masterclass');
      expect(screen.getByTestId('final-score')).toHaveTextContent('95%');
    });
  });
});
