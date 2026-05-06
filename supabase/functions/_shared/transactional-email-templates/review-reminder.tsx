import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EntityIQ'

interface ReviewReminderProps {
  contactName?: string
  entityName?: string
  reviewYear?: string | number
  reviewUrl?: string
  expiresAt?: string
}

const formatDate = (iso?: string) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  } catch { return '' }
}

const ReviewReminderEmail = ({
  contactName, entityName, reviewYear, reviewUrl, expiresAt,
}: ReviewReminderProps) => {
  const salutation = contactName || 'there'
  const expirationDate = formatDate(expiresAt)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`Your ${reviewYear ?? ''} Annual Review for ${entityName ?? ''} is ready`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>{SITE_NAME}</Heading>
            <Text style={tagline}>ANNUAL REVIEW SYSTEM</Text>
          </Section>
          <Section style={content}>
            <Heading as="h2" style={h2}>Hi {salutation},</Heading>
            <Text style={text}>
              Your <strong>{reviewYear} Annual Review Worksheet</strong> for <strong>{entityName}</strong> is ready for you to complete.
            </Text>
            <Text style={text}>
              Please take a few minutes to review the pre-populated information and provide any updates for the current year. This helps us keep your entity records accurate and up to date.
            </Text>
            {reviewUrl && (
              <Section style={{ textAlign: 'center', margin: '28px 0' }}>
                <Button href={reviewUrl} style={button}>
                  Complete Your Annual Review
                </Button>
              </Section>
            )}
            {expirationDate && (
              <Section style={notice}>
                <Text style={noticeText}>
                  ⏳ <strong>This link expires on {expirationDate}.</strong> Please complete your review before this date.
                </Text>
              </Section>
            )}
          </Section>
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated message from {SITE_NAME}. If you have questions, please reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ReviewReminderEmail,
  subject: (data: Record<string, any>) =>
    `Action Required: ${data.reviewYear ?? ''} Annual Review — ${data.entityName ?? ''}`,
  displayName: 'Annual Review Reminder',
  previewData: {
    contactName: 'Jane Doe',
    entityName: 'Acme LLC',
    reviewYear: 2026,
    reviewUrl: 'https://entityiq.net/review/sample',
    expiresAt: '2026-06-01T00:00:00Z',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: 0 }
const container = { maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff' }
const header = { backgroundColor: '#1a1a2e', padding: '28px 40px', textAlign: 'center' as const }
const brand = { margin: 0, fontSize: '26px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px' }
const tagline = { margin: '6px 0 0', fontSize: '12px', color: '#8b8fa3', letterSpacing: '1.5px' }
const content = { padding: '36px 40px 20px' }
const h2 = { margin: '0 0 20px', fontSize: '20px', color: '#1a1a2e', fontWeight: 600 }
const text = { margin: '0 0 16px', fontSize: '15px', lineHeight: '1.6', color: '#3c3c4a' }
const button = { backgroundColor: '#2563eb', color: '#ffffff', fontSize: '15px', fontWeight: 600, textDecoration: 'none', padding: '14px 36px', borderRadius: '6px' }
const notice = { backgroundColor: '#fef9e7', borderRadius: '6px', border: '1px solid #f5e6a3', padding: '14px 18px' }
const noticeText = { margin: 0, fontSize: '13px', color: '#92680a' }
const footer = { padding: '24px 40px 32px', borderTop: '1px solid #eee' }
const footerText = { margin: 0, fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', textAlign: 'center' as const }
