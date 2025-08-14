/**
 * Performance and connection testing utilities
 */

import { doc, getDoc, setDoc, deleteDoc, collection } from "firebase/firestore";
import { db } from "../firebase/config";

export interface ConnectionTestResult {
  readLatency: number;
  writeLatency: number;
  deleteLatency: number;
  totalLatency: number;
  success: boolean;
  error?: string;
}

/**
 * Test Firestore connection speed and write performance
 */
export async function testFirestoreConnection(): Promise<ConnectionTestResult> {
  const startTime = performance.now();
  let readLatency = 0;
  let writeLatency = 0;
  let deleteLatency = 0;
  
  try {
    console.log("🧪 Starting Firestore connection test...");
    
    // Test document reference
    const testRef = doc(collection(db, "connection_tests"), `test_${Date.now()}`);
    
    // Test write operation
    const writeStart = performance.now();
    await setDoc(testRef, {
      timestamp: Date.now(),
      testData: "performance_test",
      userAgent: navigator.userAgent,
    });
    writeLatency = performance.now() - writeStart;
    console.log(`✍️  Write test: ${writeLatency.toFixed(2)}ms`);
    
    // Test read operation  
    const readStart = performance.now();
    const docSnap = await getDoc(testRef);
    readLatency = performance.now() - readStart;
    console.log(`📖 Read test: ${readLatency.toFixed(2)}ms`);
    
    if (!docSnap.exists()) {
      throw new Error("Test document was not created properly");
    }
    
    // Test delete operation
    const deleteStart = performance.now();
    await deleteDoc(testRef);
    deleteLatency = performance.now() - deleteStart;
    console.log(`🗑️  Delete test: ${deleteLatency.toFixed(2)}ms`);
    
    const totalLatency = performance.now() - startTime;
    
    const result: ConnectionTestResult = {
      readLatency,
      writeLatency,
      deleteLatency,
      totalLatency,
      success: true,
    };
    
    console.log("🎉 Connection test completed:", result);
    return result;
    
  } catch (error) {
    const totalLatency = performance.now() - startTime;
    console.error("❌ Connection test failed:", error);
    
    return {
      readLatency,
      writeLatency,
      deleteLatency,
      totalLatency,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get performance diagnostics
 */
export function getPerformanceDiagnostics() {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    connection: connection ? {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    } : null,
    memory: (performance as any).memory ? {
      usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
      totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
      jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
    } : null,
  };
}

/**
 * Log performance warning if operation is slow
 */
export function logSlowOperation(operationName: string, duration: number, threshold: number = 1000) {
  if (duration > threshold) {
    console.warn(`⚠️  Slow operation detected: ${operationName} took ${duration.toFixed(2)}ms (threshold: ${threshold}ms)`);
    console.log("Performance diagnostics:", getPerformanceDiagnostics());
  }
}