import type { NextApiRequest, NextApiResponse } from 'next';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebaseConfig';
import Papa from 'papaparse';

interface BTCMetrics {
  Date: string;
  Open: number;
  High: number;
  Volume: number;
  'Number of trades': number;
  avg_block_size: number;
  value: number;
  net_order_flow: number;
  num_user_addresses: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const filePath = 'data/cleaned_data.csv';
    const metricsRef = ref(storage, filePath);

    console.log('Attempting to fetch metrics:', {
      filePath,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });

    const downloadURL = await getDownloadURL(metricsRef);
    console.log('Successfully got download URL');

    const response = await fetch(downloadURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch file. HTTP status: ${response.status}`);
    }

    const csvText = await response.text();
    const parsed = Papa.parse<BTCMetrics>(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      console.error('CSV parsing errors:', parsed.errors);
      throw new Error('Error parsing CSV data.');
    }

    const data = parsed.data;
    const latestData = data[data.length - 1];
    const historicalData = data.slice(-48);

    res.status(200).json({
      metrics: latestData,
      historical: historicalData.map((entry) => ({
        time: new Date(entry.Date).toLocaleTimeString(),
        price: entry.Open,
        timestamp: new Date(entry.Date).getTime(),
      })),
      lastUpdated: latestData.Date,
    });
  } catch (error) {
    console.error('Detailed error in fetch metrics:', {
      error,
      firebaseConfig: {
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      }
    });
    res.status(500).json({
      error: 'Failed to fetch metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
