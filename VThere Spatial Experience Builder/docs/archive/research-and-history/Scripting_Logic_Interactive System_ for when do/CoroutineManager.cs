/******************************************************************************/
/*!
\group  	CtrlAlt
\file		CoroutineManager.cs
\author 	Sherman Goh Wee Hao             
\par    	shermanweehao.goh@digipen.edu

	
\date   	23 Feb, 2025 [week 7]
\brief		(Successful) Failed implementation of Coroutines,

\par
    This our implementation of Coroutines.
    It is good as it help us create a separate method/function to run 
    by itself.
    I found the problem of the particular script keeping track of its 
    own Coroutines so therefore I added the return value and isCoroutine
    -Running. 
    Thus, designer can follow a principal of one coroutine at one time. To
    Not have multiple same Coroutines running.
        

\note


Copyright (C) 2025 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;

namespace CtrlAltScripts
{
#pragma warning disable CS8603
#pragma warning disable CS8604
#pragma warning disable CS8618
    public class CoroutineManager
    {

        // derelic this.
        private static CoroutineManager _instance;

        public static CoroutineManager Instance
        {
            get
            {
                //Console.WriteLine("Coroutine Manager getter triggered");
                if (_instance == null)
                {
                    //Console.WriteLine("Coroutine Manager is null");
                    _instance = new CoroutineManager(); // Ensure it's created
                }
                //Console.WriteLine("Coroutine Manager returning instance");
                return _instance;
            }
        }

        private List<IEnumerator> coroutines = new List<IEnumerator>();
        // I fear concurrency
        private List<IEnumerator> newCoroutines = new List<IEnumerator>(); // Temporary list

            // this is a map of coroutines to itself
        private Dictionary<IEnumerator, IEnumerator> coroutineLookup = new Dictionary<IEnumerator, IEnumerator>();

        /*
         * In C++, you might think of newCoroutines and coroutines as separate containers. 
         * But in C#, all collections store references to the same coroutine instance.
        */


        // update, can add a pointer to the coroutine in return.
        public IEnumerator StartCoroutine(IEnumerator coroutine)
        {
            //Console.WriteLine("Coroutine Started");
            if (coroutine != null)
            {
                ///Console.WriteLine("Input is not empty, Adding to temp list");
                newCoroutines.Add(coroutine); // Add to temp list first
                //Console.WriteLine("Added");
                coroutineLookup[coroutine] = coroutine; // Store reference

                return coroutine; // Return coroutine so script can store it
            }
            else
            {
                Console.WriteLine("coroutine added is null, " + nameof(coroutine));
                return null;
            }
        }

        public void StopCoroutine(IEnumerator coroutine)
        {
            if (coroutine == null || !coroutineLookup.ContainsKey(coroutine))
                return;

            coroutines.Remove(coroutine);
            newCoroutines.Remove(coroutine);
            coroutineLookup.Remove(coroutine);
        }

        public bool IsCoroutineRunning(IEnumerator coroutine)
        {
            return coroutine != null && coroutineLookup.ContainsKey(coroutine);
        }


        public void ClearCoroutines()
        {
            // Clear the main list of coroutines
            coroutines.Clear();

            // Clear the temporary list of new coroutines
            newCoroutines.Clear();

            // Clear the coroutine lookup dictionary
            coroutineLookup.Clear(); 

            Console.WriteLine("All coroutines cleared!"); 
        }



        //[DebuggerBrowsable(DebuggerBrowsableState.Never)]
        //public List<IEnumerator> activeCoroutines = new List<IEnumerator>();

        //public void StartCoroutine(IEnumerator coroutine)
        //{
        //    activeCoroutines.Add(coroutine);
        //}


        public void Update() // this will be fixed update.
        {
            if (coroutines == null)
                return;

            // Move new coroutines to the main list at the start of Update()
            if (newCoroutines.Count > 0)
            {
                coroutines.AddRange(newCoroutines);
                newCoroutines.Clear();
            }

            if (coroutines.Count == 0)
                return;

            for (int i = coroutines.Count - 1; i >= 0; i--)
            {
                var enumerator = coroutines[i];

                if (enumerator == null)
                {
                    coroutines.RemoveAt(i);
                    if (coroutineLookup != null)
                        coroutineLookup.Remove(enumerator);
                    continue;
                }

                try
                {
                    if (enumerator.Current is WaitForSeconds wait && !wait.IsDone())
                        continue; // Skip unfinished coroutines

                    if (!enumerator.MoveNext()) // If coroutine finished
                    {
                        coroutines.RemoveAt(i);
                        if (coroutineLookup != null)
                            coroutineLookup.Remove(enumerator);
                    }
                }
                catch (Exception ex)
                {
                    string message = ex.Message;
                    Console.WriteLine("Error in Coroutine Update: {0}", message);
                    coroutines.RemoveAt(i);
                    if (coroutineLookup != null)
                        coroutineLookup.Remove(enumerator);
                }
            }// end of for loop

        }



        //public void Update()
        //{
        //    for (int i = coroutines.Count - 1; i >= 0; i--)
        //    {
        //        if (!coroutines[i].MoveNext())
        //        {
        //            coroutines.RemoveAt(i);
        //        }
        //    }
        //}

    }

    public class WaitForSeconds
    {
        private float duration;
        private float startTime;

        public WaitForSeconds(float seconds)
        {
            //Console.WriteLine("WaitForSeconds Started。");
            duration = seconds;
            startTime = Time.time; // dk If i want to accumulate time with delta time instead?
        }

        public bool IsDone()
        {
            //Console.WriteLine("IsDone。");
            return (Time.time - startTime) >= duration;
        }
    }

        // can't use this because of Mono limitations.
    //public class WaitForSeconds
    //{
    //    private float duration;
    //    private DateTime startTime;

    //    public WaitForSeconds(float seconds)
    //    {
    //        duration = seconds;
    //        startTime = DateTime.Now;
    //    }

    //    public bool MoveNext()
    //    {
    //        return (DateTime.Now - startTime).TotalSeconds < duration;
    //    }
    //}


}

//gg
