/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, Gift } from './types';

// Based on standard spiritual gifts often used in these tests
export const INITIAL_GIFTS: Gift[] = [
  {
    id: 'administration',
    name: 'Administration',
    description: 'The gift of organizing and managing people and resources to achieve goals.',
    scripture: '1 Corinthians 12:28',
    serviceTeams: ['Office Support', 'Event Planning', 'Operations Team']
  },
  {
    id: 'discernment',
    name: 'Discernment',
    description: 'The ability to distinguish between truth and error, or between different spirits.',
    scripture: '1 Corinthians 12:10',
    serviceTeams: ['Prayer Team', 'Leadership Council', 'Conflict Resolution']
  },
  {
    id: 'encouragement',
    name: 'Encouragement (Exhortation)',
    description: 'The gift of motivating and comforting others in their faith journey.',
    scripture: 'Romans 12:8',
    serviceTeams: ['Hospitality', 'Small Group Leader', 'Greeting Team']
  },
  {
    id: 'evangelism',
    name: 'Evangelism',
    description: 'The special ability to share the Gospel in a way that leads people to faith.',
    scripture: 'Ephesians 4:11',
    serviceTeams: ['Outreach Team', 'Alpha Course', 'Missions']
  },
  {
    id: 'faith',
    name: 'Faith',
    description: 'The gift of unusual confidence in God\'s promises and power.',
    scripture: '1 Corinthians 12:9',
    serviceTeams: ['Intercessory Prayer', 'Visionary Leadership', 'New Ministry Starts']
  },
  {
    id: 'giving',
    name: 'Giving',
    description: 'The gift of contributing resources with exceptional generosity and cheerfulness.',
    scripture: 'Romans 12:8',
    serviceTeams: ['Finance Committee', 'Benevolence Team', 'Missions Support']
  },
  {
    id: 'hospitality',
    name: 'Hospitality',
    description: 'The ability to make guests and strangers feel welcome and cared for.',
    scripture: '1 Peter 4:9',
    serviceTeams: ['Greeters', 'Coffee Hour', 'Ushers']
  },
  {
    id: 'leadership',
    name: 'Leadership',
    description: 'The gift of setting goals and inspiring others to work together toward them.',
    scripture: 'Romans 12:8',
    serviceTeams: ['Board of Elders', 'Team Lead', 'Ministry Director']
  },
  {
    id: 'mercy',
    name: 'Mercy',
    description: 'The gift of showing compassion and empathy to those who are suffering.',
    scripture: 'Romans 12:8',
    serviceTeams: ['Visitation Team', 'Crisis Support', 'Social Justice']
  },
  {
    id: 'service',
    name: 'Service / Helps',
    description: 'The gift of selflessly assisting others in practical ways to support ministry.',
    scripture: 'Romans 12:7',
    serviceTeams: ['Set-up Team', 'Facilities Care', 'Kitchen Ministry']
  },
  {
    id: 'teaching',
    name: 'Teaching',
    description: 'The ability to explain and apply God\'s Word in a way that others can understand.',
    scripture: 'Romans 12:7',
    serviceTeams: ['Sunday School', 'Bible Study Leader', 'Youth Ministry']
  },
  {
    id: 'wisdom',
    name: 'Wisdom',
    description: 'The gift of applying God\'s truth to specific situations with spiritual insight.',
    scripture: '1 Corinthians 12:8',
    serviceTeams: ['Counseling', 'Board of Trustees', 'Mentoring']
  }
];

export const INITIAL_QUESTIONS: Question[] = [
  // Administration
  { id: '1', text: 'I enjoy organizing tasks and people to reach a goal.', giftId: 'administration' },
  { id: '2', text: 'I can break down complex projects into simpler steps.', giftId: 'administration' },
  // Discernment
  { id: '3', text: 'I can often sense when someone is being insincere or dishonest.', giftId: 'discernment' },
  { id: '4', text: 'I am good at identifying a teaching that is not biblically sound.', giftId: 'discernment' },
  // Encouragement
  { id: '5', text: 'I find joy in speaking words of hope to people who are struggling.', giftId: 'encouragement' },
  { id: '6', text: 'People often come to me for advice or comfort.', giftId: 'encouragement' },
  // Evangelism
  { id: '7', text: 'I look for opportunities to share my faith with non-believers.', giftId: 'evangelism' },
  { id: '8', text: 'I feel a strong burden to tell others about Christ.', giftId: 'evangelism' },
  // Faith
  { id: '9', text: 'I have a deep confidence that God will act even in "impossible" situations.', giftId: 'faith' },
  { id: '10', text: 'I am willing to take big risks for God\'s kingdom.', giftId: 'faith' },
  // Giving
  { id: '11', text: 'I find it easy to give money or resources away generously.', giftId: 'giving' },
  { id: '12', text: 'I manage my finances well so I can give more to the church.', giftId: 'giving' },
  // Hospitality
  { id: '13', text: 'I love having people over to my home and making them feel welcome.', giftId: 'hospitality' },
  { id: '14', text: 'I notice when someone is new or alone and try to make them feel included.', giftId: 'hospitality' },
  // Leadership
  { id: '15', text: 'I enjoy leading a group toward a common objective.', giftId: 'leadership' },
  { id: '16', text: 'I am comfortable making decisions that affect other people.', giftId: 'leadership' },
  // Mercy
  { id: '17', text: 'I feel deeply for those who are in pain or distress.', giftId: 'mercy' },
  { id: '18', text: 'I find it natural to care for those who are often overlooked.', giftId: 'mercy' },
  // Service
  { id: '19', text: 'I would rather work behind the scenes than be in the spotlight.', giftId: 'service' },
  { id: '20', text: 'I find great satisfaction in doing small, practical tasks for others.', giftId: 'service' },
  // Teaching
  { id: '21', text: 'I love studying the Bible and sharing what I\'ve learned with others.', giftId: 'teaching' },
  { id: '22', text: 'I am able to explain complex biblical truths clearly.', giftId: 'teaching' },
  // Wisdom
  { id: '23', text: 'I often see the best way forward when others are confused.', giftId: 'wisdom' },
  { id: '24', text: 'My friends often seek my perspective on difficult life decisions.', giftId: 'wisdom' }
];
