/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for 52 Things to Know</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={card}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset the password for your 52 Things to
            Know account. Tap the button below to choose a new one.
          </Text>
          <Section style={{ textAlign: 'center', margin: '32px 0 8px' }}>
            <Button style={button} href={confirmationUrl}>
              Reset my password
            </Button>
          </Section>
          <Text style={footer}>
            If you didn't request a password reset, you can safely ignore this
            email — your password will stay the same.
          </Text>
        </Section>
        <Text style={signature}>
          With warmth,<br />
          The 52 Things to Know team
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "Georgia, 'Times New Roman', serif",
  margin: 0,
  padding: 0,
}
const outer = {
  backgroundColor: '#F5F0E8',
  padding: '40px 20px',
  maxWidth: '600px',
  margin: '0 auto',
}
const card = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '40px 36px',
  border: '1px solid #E8DFCE',
}
const h1 = {
  fontSize: '26px',
  fontWeight: 'normal' as const,
  color: '#3A2E1F',
  margin: '0 0 20px',
  textAlign: 'center' as const,
  fontFamily: "Georgia, 'Times New Roman', serif",
}
const text = {
  fontSize: '16px',
  color: '#4A3F2E',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#2C7A7B',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '13px',
  color: '#8A7F6E',
  margin: '24px 0 0',
  textAlign: 'center' as const,
}
const signature = {
  fontSize: '13px',
  color: '#8A7F6E',
  textAlign: 'center' as const,
  margin: '24px 0 0',
  fontStyle: 'italic' as const,
}
