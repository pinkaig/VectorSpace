/******************************************************************************/
/*!
\group  	CtrlAlt
\file		Component.cs
\author 	Chase Rodrigues                 [90%]
\co-par    	rodrigues.i@digipen.edu
\author 	Sherman Goh Wee Hao             [5%]
\par    	shermanweehao.goh@digipen.edu
\co-author 	NG Ezekiel Fu Xiang             [5%]
\par    	ezekiefuxiang.ng@digipen.edu
	
\date   	XX XX, 2025 [week XX]
\brief		GameObject would correspond to C++ Entities.

\par
        NO TIME TO FILL

\note


Copyright (C) 2025 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/
using System;
using System.Runtime.CompilerServices;

namespace CtrlAltScripts
{
    public class GameObject
    {
#pragma warning disable CS8618
        public GameObject(int id)
        {
            ID = id;
            transform = new Transform() { gameObject = this };
        }
#pragma warning restore CS8618

        public int ID;

        public Transform    transform { get; internal set; }

        public bool         active  { get; internal set; }

        public Renderer     ?renderer { get; internal set; }

        public MonoScript   ?script { get; internal set; }  // Sherman: Put it under Component 


        public bool HasComponent<T>() where T : Component, new()
        {
            Console.WriteLine("Checking if has component");

            Type componentType = typeof(T);
            bool has = FunctionCalls.GameObject_HasComponent(ID, componentType);
            Console.WriteLine("Checking if has component");

            return has;
        }

        public T GetComponent<T>() where T : Component, new()
        {
            //Console.WriteLine("Trying to get component");

            //if (!HasComponent<T>())
            //    return null;

            T component = new T() { gameObject = this };
            return component;
        }

        public T AddComponent<T>() where T : Component, new()
        {
            if (!HasComponent<T>())
#pragma warning disable CS8603
                return null;
#pragma warning restore CS8603

            T component = new T() { gameObject = this };

            return component;
        }

        // Sherman: could be derelic
#pragma warning disable CS8603 // HAHHAHA SHERMAN THIS WARNING COULD BE RELEVANT
        public T GetScript<T>() where T : MonoScript
        {
            //lol
            var script_comp = GetComponent<Script>();

            return script_comp.script as T; // Safely cast to the derived type
        }
#pragma warning restore CS8603


        public void SetActive(bool value)
        {
            // I cannot do parenting active.
            FunctionCalls.SetActive(this.ID, value); 
            this.active = value;
        }

        public void Destroy()
        {
            FunctionCalls.Destroy(ID);
        }

        public static GameObject FindGameObjectByName(string name)
        {
#pragma warning disable CS8603
            int id = FunctionCalls.GameObject_FindGameObjectByName(name);
            if (id == 0)
                return null;
#pragma warning restore CS8603

            return new GameObject(id);
        }

        //public T As<T>() where T : Entity, new()
        //{
        //    object instance = InternalCalls.GetScriptInstance(ID);
        //    return instance as T;
        //}
    }
}