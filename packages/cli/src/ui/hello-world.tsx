import React from 'react';
import { Text, Box } from 'ink';

export const HelloWorld: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">
        Hello from Ink!
      </Text>
      <Text color="gray">
        This is a React component rendered in the terminal.
      </Text>
    </Box>
  );
};
